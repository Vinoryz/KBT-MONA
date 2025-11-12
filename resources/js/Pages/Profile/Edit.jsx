import { Head, useForm, usePage, Link, router } from "@inertiajs/react";
import { UserIcon, KeyIcon, XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { PencilIcon } from "@heroicons/react/24/solid";
import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import PrimaryButton from "@/Components/PrimaryButton";
import TextInput from "@/Components/TextInput";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Transition } from "@headlessui/react";
import AppLayout from "@/Layouts/AppLayout";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useState, useRef, useCallback } from "react";

export default function Edit({ mustVerifyEmail, status }) {
    const { auth } = usePage().props;
    const user = auth.user;

    const avatarUrl = user.profile_photo_path
        ? `/storage/${user.profile_photo_path}`
        : null; // We'll use a custom div instead of ui-avatars

    // Crop modal state
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [crop, setCrop] = useState({
        unit: "%",
        width: 50,
        height: 50,
        x: 25,
        y: 25,
        aspect: 1,
    });
    const [completedCrop, setCompletedCrop] = useState(null);
    const [croppedImageUrl, setCroppedImageUrl] = useState(null);
    const [showMobileOptions, setShowMobileOptions] = useState(false);
    const imgRef = useRef(null);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({
        title: '',
        message: '',
        confirmText: 'Confirm',
        confirmColor: 'bg-growth-green-500 hover:bg-growth-green-600',
    });
    // State untuk 'profile', 'password', atau 'removePhoto'
    const [actionToConfirm, setActionToConfirm] = useState(null);
    
    // Success modal state
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [successTitle, setSuccessTitle] = useState("");

    // Parse date_of_birth from user data
    const parseDateOfBirth = (dateString) => {
        if (!dateString) return null;

        // Try to parse dd/mm/yyyy format
        const ddmmyyyyPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const ddmmyyyyMatch = dateString.match(ddmmyyyyPattern);
        if (ddmmyyyyMatch) {
            const [, day, month, year] = ddmmyyyyMatch;
            return new Date(year, month - 1, day);
        }

        // Try to parse yyyy-mm-dd format (from database)
        const yyyymmddPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
        const yyyymmddMatch = dateString.match(yyyymmddPattern);
        if (yyyymmddMatch) {
            const [, year, month, day] = yyyymmddMatch;
            return new Date(year, month - 1, day);
        }

        // Fallback: try to parse as a general date
        const parsedDate = new Date(dateString);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
    };

    const [selectedDate, setSelectedDate] = useState(
        parseDateOfBirth(user.date_of_birth)
    );

    // Form profile
    const {
        data: profileData,
        setData: setProfileData,
        patch: patchProfile,
        errors: profileErrors,
        processing: profileProcessing,
    } = useForm({
        first_name: user.name?.split(" ")[0] || "",
        last_name: user.name?.split(" ").slice(1).join(" ") || "",
        email: user.email,
        phone: user.phone || "",
        date_of_birth: user.date_of_birth || "",
        profile_photo: null,
    });

    const handleActualProfileSave = () => {
        // Combine first and last name
        const fullName =
            `${profileData.first_name} ${profileData.last_name}`.trim();

        // Format date to dd/mm/yyyy if a date is selected
        let formattedDate = profileData.date_of_birth;
        if (selectedDate) {
            const day = String(selectedDate.getDate()).padStart(2, "0");
            const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
            const year = selectedDate.getFullYear();
            formattedDate = `${day}/${month}/${year}`;
        }

        // Prepare form data ensuring all required fields are present
        const formData = {
            name: fullName,
            email: profileData.email,
            phone: profileData.phone || "",
            date_of_birth: formattedDate || "",
            _method: "PATCH",
        };

        // Only add profile_photo if it exists
        if (profileData.profile_photo) {
            formData.profile_photo = profileData.profile_photo;
        }

        // Use router.post for file uploads with multipart data
        // Inertia automatically handles CSRF token
        router.post(route("profile.update"), formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                // Show success modal
                setSuccessTitle("Profile Updated!");
                setSuccessMessage("Your profile has been successfully updated.");
                setShowSuccessModal(true);
                
                // Auto-dismiss after 2 seconds (stay on edit page)
                setTimeout(() => {
                    setShowSuccessModal(false);
                }, 2000);
            },
            onError: (errors) => {
                console.log("Form errors:", errors);
                // Handle session expired error
                if (errors.message && errors.message.includes("419")) {
                    alert(
                        "Your session has expired. Please refresh the page and try again."
                    );
                    window.location.reload();
                }
            },
            onException: (error) => {
                // Handle 419 CSRF token mismatch
                if (error.response && error.response.status === 419) {
                    alert(
                        "Your session has expired. The page will now reload."
                    );
                    window.location.reload();
                }
            },
        });
    };

    // 'submitProfile'
    const submitProfile = (e) => {
        e.preventDefault();
        setModalContent({
            title: 'Save Profile Changes?',
            message: 'Are you sure you want to save your updated profile information?',
            confirmText: 'Save',
            confirmColor: 'bg-red-500 hover:bg-red-600',
        });
        setActionToConfirm('profile');
        setIsConfirmModalOpen(true);
    };

    // Handle date change
    const handleDateChange = (date) => {
        setSelectedDate(date);
        if (date) {
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            setProfileData("date_of_birth", `${day}/${month}/${year}`);
        } else {
            setProfileData("date_of_birth", "");
        }
    };

    // Form password
    const {
        data: passwordData,
        setData: setPasswordData,
        put: putPassword,
        errors: passwordErrors,
        processing: passwordProcessing,
        reset: resetPassword,
    } = useForm({
        current_password: "",
        password: "",
        password_confirmation: "",
    });

    const handleActualPasswordSave = () => {
        putPassword(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => {
                resetPassword();
                // Show success modal
                setSuccessTitle("Password Updated!");
                setSuccessMessage("Your password has been successfully changed.");
                setShowSuccessModal(true);
                
                // Auto-dismiss after 2 seconds
                setTimeout(() => {
                    setShowSuccessModal(false);
                }, 2000);
            },
        });
    };

    // 'submitPassword'
    const submitPassword = (e) => {
        e.preventDefault();
        setModalContent({
            title: 'Update Password?',
            message: 'Are you sure you want to update your password?',
            confirmText: 'Update',
            confirmColor: 'bg-red-500 hover:bg-red-600',
        });
        setActionToConfirm('password');
        setIsConfirmModalOpen(true);
    };

    // Image cropping functions
    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setSelectedImage(reader.result);
                // Reset crop when selecting new image
                setCrop({
                    unit: "%",
                    width: 80,
                    height: 80,
                    x: 10,
                    y: 10,
                    aspect: 1,
                });
                setCompletedCrop(null);
                setIsCropModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const getCroppedImg = useCallback((image, crop) => {
        const canvas = document.createElement("canvas");
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = crop.width;
        canvas.height = crop.height;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width,
            crop.height
        );

        return new Promise((resolve) => {
            canvas.toBlob(resolve, "image/jpeg", 1);
        });
    }, []);

    const handleCropComplete = async () => {
        if (completedCrop && imgRef.current) {
            const croppedBlob = await getCroppedImg(
                imgRef.current,
                completedCrop
            );
            const croppedFile = new File([croppedBlob], "cropped-avatar.jpg", {
                type: "image/jpeg",
            });

            // Preserve existing form data when setting new profile photo
            setProfileData((prev) => ({
                ...prev,
                profile_photo: croppedFile,
            }));
            const url = URL.createObjectURL(croppedBlob);
            setCroppedImageUrl(url);
            setIsCropModalOpen(false);

            // Reset the file input so user can select a new file again
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.value = "";
            }
        }
    };

    const handleCropCancel = () => {
        setIsCropModalOpen(false);
        setSelectedImage(null);
        setCrop({
            unit: "%",
            width: 50,
            height: 50,
            x: 25,
            y: 25,
            aspect: 1,
        });
        setCompletedCrop(null);
        // Reset the file input so user can select the same file again
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.value = "";
        }
    };

    const handleActualRemovePhoto = () => {
        setProfileData('profile_photo', null);
        setCroppedImageUrl(null);
        
        // If user has existing photo, send request to remove it
        if (user.profile_photo_path) {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            router.post(route('profile.remove-photo'), {
                _method: 'DELETE',
                _token: token,
            }, {
                onSuccess: () => {
                    window.location.reload();
                }
            });
        }
    };

    //  'handleRemovePhoto'
    const handleRemovePhoto = () => {
        setModalContent({
            title: 'Remove Profile Picture?',
            message: 'Are you sure you want to remove your profile picture?',
            confirmText: 'Remove',
            confirmColor: 'bg-red-600 hover:bg-red-700', 
        });
        setActionToConfirm('removePhoto');
        setIsConfirmModalOpen(true);
        setShowMobileOptions(false);
    };

    const handleModalClose = () => {
        setIsConfirmModalOpen(false);
        setTimeout(() => {
            setActionToConfirm(null);
            setModalContent({
                title: '',
                message: '',
                confirmText: 'Confirm',
                confirmColor: 'bg-growth-green-500 hover:bg-growth-green-600',
            });
        }, 300);
    };

    const handleModalConfirm = () => {
        if (actionToConfirm === 'profile') {
            handleActualProfileSave();
        } else if (actionToConfirm === 'password') {
            handleActualPasswordSave();
        } else if (actionToConfirm === 'removePhoto') {
            handleActualRemovePhoto();
        }
        handleModalClose();
    };

    return (
        <AppLayout title="Edit Profile" auth={auth}>
            <Head title="Edit Profile" />

            <div className="py-8">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                    {/* Box Profile Information */}
                    <div className="p-8 bg-white shadow-md rounded-2xl relative">
                        <div className="flex items-start space-x-4 mb-6">
                            <UserIcon className="h-8 w-8 text-gray-500" />
                            <div>
                                <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                                    Profile Information
                                </h2>
                                <p className="mt-1 text-xs md:text-sm text-gray-600">
                                    Update your personal details and contact
                                    information.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={submitProfile} className="space-y-6">
                            {/* Avatar Upload */}
                            <div
                                className="relative w-32 h-32 group"
                                onClick={(e) => {
                                    // Click outside overlay area hides mobile options
                                    if (
                                        showMobileOptions &&
                                        e.target === e.currentTarget
                                    ) {
                                        setShowMobileOptions(false);
                                    }
                                }}
                            >
                                {croppedImageUrl ||
                                profileData.profile_photo ||
                                user.profile_photo_path ? (
                                    <img
                                        src={
                                            croppedImageUrl ||
                                            (profileData.profile_photo
                                                ? URL.createObjectURL(
                                                      profileData.profile_photo
                                                  )
                                                : avatarUrl)
                                        }
                                        alt="Profile Avatar"
                                        className="h-32 w-32 rounded-full object-cover shadow transition-all duration-300 group-hover:brightness-75"
                                    />
                                ) : (
                                    <div className="h-32 w-32 rounded-full bg-[#058743] flex items-center justify-center text-white font-bold text-4xl shadow transition-all duration-300 group-hover:brightness-75">
                                        {user.name
                                            ? user.name
                                                  .split(" ")
                                                  .map((n) => n.charAt(0))
                                                  .join("")
                                                  .toUpperCase()
                                                  .slice(0, 2)
                                            : "U"}
                                    </div>
                                )}

                                {/* Hover Hint - Desktop only */}
                                <div
                                    className="hidden md:block absolute inset-0 rounded-full bg-black bg-opacity-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMobileOptions(true);
                                    }}
                                />

                                {/* Click Trigger - Mobile */}
                                <div
                                    className="md:hidden absolute inset-0 cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMobileOptions(true);
                                    }}
                                />

                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                />
                                <InputError
                                    className="mt-2"
                                    message={profileErrors.profile_photo}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <InputLabel
                                        htmlFor="first_name"
                                        value="First Name"
                                    />
                                    <TextInput
                                        id="first_name"
                                        className="mt-1 block w-full"
                                        value={profileData.first_name}
                                        onChange={(e) =>
                                            setProfileData(
                                                "first_name",
                                                e.target.value
                                            )
                                        }
                                        required
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={profileErrors.first_name}
                                    />
                                </div>

                                <div>
                                    <InputLabel
                                        htmlFor="last_name"
                                        value="Last Name"
                                    />
                                    <TextInput
                                        id="last_name"
                                        className="mt-1 block w-full"
                                        value={profileData.last_name}
                                        onChange={(e) =>
                                            setProfileData(
                                                "last_name",
                                                e.target.value
                                            )
                                        }
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={profileErrors.last_name}
                                    />
                                </div>

                                <div>
                                    <InputLabel htmlFor="email" value="Email" />
                                    <TextInput
                                        id="email"
                                        type="email"
                                        className="mt-1 block w-full"
                                        value={profileData.email}
                                        onChange={(e) =>
                                            setProfileData(
                                                "email",
                                                e.target.value
                                            )
                                        }
                                        required
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={profileErrors.email}
                                    />
                                </div>

                                <div>
                                    <InputLabel htmlFor="phone" value="Phone" />
                                    <TextInput
                                        id="phone"
                                        className="mt-1 block w-full"
                                        value={profileData.phone}
                                        onChange={(e) =>
                                            setProfileData(
                                                "phone",
                                                e.target.value
                                            )
                                        }
                                    />
                                    <InputError
                                        className="mt-2"
                                        message={profileErrors.phone}
                                    />
                                </div>

                                <div>
                                    <InputLabel
                                        htmlFor="date_of_birth"
                                        value="Date of Birth"
                                    />
                                    <div className="relative mt-1">
                                        <DatePicker
                                            selected={selectedDate}
                                            onChange={handleDateChange}
                                            dateFormat="dd/MM/yyyy"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg cursor-pointer focus:ring-2 focus:ring-[#058743] focus:border-transparent"
                                            calendarClassName="custom-calendar"
                                            wrapperClassName="w-full"
                                            placeholderText="DD/MM/YYYY"
                                            showPopperArrow={false}
                                            maxDate={new Date()}
                                            showYearDropdown
                                            showMonthDropdown
                                            dropdownMode="select"
                                            yearDropdownItemNumber={100}
                                            scrollableYearDropdown
                                            onKeyDown={(e) => {
                                                // Prevent all keyboard input except Tab for accessibility
                                                if (e.key !== "Tab") {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onChangeRaw={(e) =>
                                                e.preventDefault()
                                            }
                                        />
                                        {/* Calendar Icon */}
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                            <svg
                                                className="w-5 h-5 text-gray-400"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                    <InputError
                                        className="mt-2"
                                        message={profileErrors.date_of_birth}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Link
                                    href={route("profile.show")}
                                    className="px-5 py-2 bg-gray-200 text-gray-800 font-medium rounded-lg shadow hover:bg-gray-300 transition-colors"
                                >
                                    Back to Profile
                                </Link>
                                <button
                                    type="submit"
                                    disabled={profileProcessing}
                                    className="px-5 py-2 bg-growth-green-500 text-white font-medium rounded-lg shadow hover:bg-growth-green-600 transition-colors disabled:opacity-50"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Overlay Menu - Outside of avatar container */}
                    {showMobileOptions && (
                        <div
                            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    setShowMobileOptions(false);
                                }
                            }}
                        >
                            {/* Background overlay */}
                            <div
                                className="fixed inset-0 bg-black bg-opacity-50"
                                onClick={() => setShowMobileOptions(false)}
                            />

                            {/* Menu popup */}
                            <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                                <div className="space-y-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            document
                                                .querySelector(
                                                    'input[type="file"]'
                                                )
                                                .click();
                                            setShowMobileOptions(false);
                                        }}
                                        className="w-full py-3 px-4 text-left text-growth-green-600 hover:bg-growth-green-50 rounded-lg transition-colors font-medium"
                                    >
                                        Edit your Picture
                                    </button>

                                    {(user.profile_photo_path ||
                                        croppedImageUrl) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemovePhoto();
                                            }}
                                            className="w-full py-3 px-4 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                                        >
                                            Remove your Picture
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMobileOptions(false);
                                        }}
                                        className="w-full py-3 px-4 text-left text-gray-600 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Box Update Password */}
                    <div className="p-8 bg-white shadow-md rounded-2xl">
                        <div className="flex items-start space-x-4 mb-6">
                            <KeyIcon className="h-8 w-8 text-gray-500" />
                            <div>
                                <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                                    Update Password
                                </h2>
                                <p className="mt-1 text-xs md:text-sm text-gray-600">
                                    Ensure your account is using a strong,
                                    unique password.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={submitPassword} className="space-y-6">
                            <div>
                                <InputLabel
                                    htmlFor="current_password"
                                    value="Current Password"
                                />
                                <TextInput
                                    id="current_password"
                                    type="password"
                                    className="mt-1 block w-full"
                                    value={passwordData.current_password}
                                    onChange={(e) =>
                                        setPasswordData(
                                            "current_password",
                                            e.target.value
                                        )
                                    }
                                    required
                                />
                                <InputError
                                    className="mt-2"
                                    message={passwordErrors.current_password}
                                />
                            </div>

                            <div>
                                <InputLabel
                                    htmlFor="password"
                                    value="New Password"
                                />
                                <TextInput
                                    id="password"
                                    type="password"
                                    className="mt-1 block w-full"
                                    value={passwordData.password}
                                    onChange={(e) =>
                                        setPasswordData(
                                            "password",
                                            e.target.value
                                        )
                                    }
                                    required
                                />
                                <InputError
                                    className="mt-2"
                                    message={passwordErrors.password}
                                />
                            </div>

                            <div>
                                <InputLabel
                                    htmlFor="password_confirmation"
                                    value="Confirm Password"
                                />
                                <TextInput
                                    id="password_confirmation"
                                    type="password"
                                    className="mt-1 block w-full"
                                    value={passwordData.password_confirmation}
                                    onChange={(e) =>
                                        setPasswordData(
                                            "password_confirmation",
                                            e.target.value
                                        )
                                    }
                                    required
                                />
                                <InputError
                                    className="mt-2"
                                    message={
                                        passwordErrors.password_confirmation
                                    }
                                />
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={passwordProcessing}
                                    className="px-5 py-2 bg-growth-green-500 text-white font-medium rounded-lg shadow hover:bg-growth-green-600 transition-colors disabled:opacity-50"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Image Crop Modal */}
            {isCropModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black bg-opacity-50"
                        onClick={handleCropCancel}
                    />
                    <div className="relative bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Crop Profile Image
                            </h3>
                            <button
                                onClick={handleCropCancel}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="mb-6 flex justify-center">
                            {selectedImage && (
                                <div className="w-full max-w-lg">
                                    <ReactCrop
                                        crop={crop}
                                        onChange={(newCrop) => setCrop(newCrop)}
                                        onComplete={(c) => setCompletedCrop(c)}
                                        aspect={1}
                                        circularCrop
                                        minWidth={100}
                                        minHeight={100}
                                        keepSelection
                                    >
                                        <img
                                            ref={imgRef}
                                            src={selectedImage}
                                            alt="Crop preview"
                                            style={{
                                                maxWidth: "100%",
                                                maxHeight: "400px",
                                                display: "block",
                                            }}
                                            onLoad={(e) => {
                                                const { naturalWidth, naturalHeight } = e.currentTarget;
                                                
                                                // Use the smaller dimension for a square crop
                                                // This makes the crop as large as possible while maintaining 1:1 aspect
                                                const cropSize = Math.min(naturalWidth, naturalHeight);
                                                
                                                // Calculate percentage-based crop (100% of smaller dimension)
                                                const cropWidthPercent = (cropSize / naturalWidth) * 100;
                                                const cropHeightPercent = (cropSize / naturalHeight) * 100;
                                                const cropXPercent = ((naturalWidth - cropSize) / 2 / naturalWidth) * 100;
                                                const cropYPercent = ((naturalHeight - cropSize) / 2 / naturalHeight) * 100;

                                                const newCrop = {
                                                    unit: "%",
                                                    width: cropWidthPercent,
                                                    height: cropHeightPercent,
                                                    x: cropXPercent,
                                                    y: cropYPercent,
                                                    aspect: 1,
                                                };
                                                
                                                setCrop(newCrop);
                                            }}
                                        />
                                    </ReactCrop>
                                    <p className="text-sm text-gray-500 mt-2 text-center">
                                        Drag to adjust the circular crop area
                                        for your profile picture
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleCropCancel}
                                className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCropComplete}
                                className="px-4 py-2 bg-growth-green-500 text-white font-medium rounded-lg hover:bg-growth-green-600 transition-colors"
                                disabled={!completedCrop}
                            >
                                Apply Crop
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/*Konfirmasi */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-modalFadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-modalSlideUp">
                        <div className="p-6">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4 animate-scaleIn">
                                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" aria-hidden="true" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                                {modalContent.title}
                            </h3>
                            <p className="text-gray-600 text-center mb-6">
                                {modalContent.message}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleModalClose}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleModalConfirm}
                                    disabled={profileProcessing || passwordProcessing}
                                    className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium transition-colors duration-200 disabled:opacity-50 ${
                                        modalContent.confirmColor === 'bg-growth-green-500 hover:bg-growth-green-600' 
                                            ? 'bg-[#058743] hover:bg-[#047236]' 
                                            : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {modalContent.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-modalFadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-modalSlideUp">
                        <div className="p-8 text-center">
                            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-[#058743] rounded-full mb-4 animate-scaleIn">
                                <svg
                                    className="w-8 h-8 text-white animate-checkmark"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                {successTitle}
                            </h3>
                            <p className="text-gray-600">
                                {successMessage}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom DatePicker Styles */}
            <style jsx>{`
                /* Base DatePicker Styles */
                .react-datepicker-popper {
                    z-index: 9999 !important;
                }

                .react-datepicker {
                    font-family: inherit !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15) !important;
                    border-radius: 16px !important;
                    padding: 16px !important;
                    background-color: white !important;
                }

                .react-datepicker__header {
                    background-color: white !important;
                    border-bottom: 1px solid #f0f0f0 !important;
                    padding: 16px 0 !important;
                    border-top-left-radius: 16px !important;
                    border-top-right-radius: 16px !important;
                }

                .react-datepicker__current-month {
                    font-size: 18px !important;
                    font-weight: 700 !important;
                    color: #1a1a1a !important;
                    margin-bottom: 12px !important;
                }

                .react-datepicker__day-names {
                    display: flex !important;
                    justify-content: space-between !important;
                    margin-top: 12px !important;
                }

                .react-datepicker__day-name {
                    color: #666 !important;
                    font-weight: 600 !important;
                    font-size: 13px !important;
                    width: 40px !important;
                    line-height: 40px !important;
                    margin: 0 !important;
                }

                .react-datepicker__month {
                    margin: 0 !important;
                    padding: 8px 0 !important;
                }

                .react-datepicker__week {
                    display: flex !important;
                    justify-content: space-between !important;
                }

                .react-datepicker__day {
                    width: 40px !important;
                    height: 40px !important;
                    line-height: 40px !important;
                    margin: 2px !important;
                    border-radius: 8px !important;
                    color: #1a1a1a !important;
                    font-weight: 500 !important;
                    transition: all 0.2s ease !important;
                }

                .react-datepicker__day:hover {
                    background-color: #f5f5f5 !important;
                    border-radius: 8px !important;
                }

                /* Selected date - Growth Green background with white text */
                .react-datepicker__day--selected {
                    background-color: #058743 !important;
                    color: white !important;
                    font-weight: 600 !important;
                }

                .react-datepicker__day--selected:hover {
                    background-color: #046d36 !important;
                }

                /* Remove keyboard-selected state to avoid "half pressed" appearance */
                .react-datepicker__day--keyboard-selected {
                    background-color: transparent !important;
                    color: inherit !important;
                }

                .react-datepicker__day--keyboard-selected:hover {
                    background-color: #f5f5f5 !important;
                }

                /* Today's date - Growth Green color with light background */
                .react-datepicker__day--today {
                    font-weight: 600 !important;
                    color: #058743 !important;
                    background-color: #d4eadf !important;
                }

                .react-datepicker__day--today:hover {
                    background-color: #c0e0cb !important;
                }

                /* Selected date overrides today styling - solid growth green */
                .react-datepicker__day--selected.react-datepicker__day--today {
                    background-color: #058743 !important;
                    color: white !important;
                    font-weight: 600 !important;
                }

                .react-datepicker__day--outside-month {
                    color: #d0d0d0 !important;
                }

                .react-datepicker__navigation {
                    top: 20px !important;
                }

                .react-datepicker__navigation-icon::before {
                    border-color: #666 !important;
                    border-width: 2px 2px 0 0 !important;
                }

                .react-datepicker__navigation:hover *::before {
                    border-color: #058743 !important;
                }

                /* Mobile adjustments */
                @media (max-width: 640px) {
                    .react-datepicker {
                        width: 100% !important;
                        max-width: none !important;
                        padding: 8px !important;
                    }

                    .react-datepicker__current-month {
                        font-size: 13px !important;
                    }

                    .react-datepicker__day-name,
                    .react-datepicker__day {
                        width: 28px !important;
                        height: 28px !important;
                        line-height: 28px !important;
                        font-size: 11px !important;
                    }
                }
            `}</style>

        </AppLayout>
    );
}