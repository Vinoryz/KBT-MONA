import { useState, useEffect, useRef } from "react";
import AppLayout from "@/Layouts/AppLayout";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const formatNumberWithDots = (value) => {
    if (!value) return "";
    const digits = String(value).replace(/\D/g, "");

    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseFormattedNumber = (formattedValue) => {
    return formattedValue.replace(/\./g, "");
};

export default function ScanReceipt({ auth }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [ocrResults, setOcrResults] = useState(null);
    const [processingTime, setProcessingTime] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1024
    );
    const [formData, setFormData] = useState({
        amount: "",
        category: "Other",
        date: "",
        description: "",
    });
    const [isDragging, setIsDragging] = useState(false);
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [showDateWarning, setShowDateWarning] = useState(false);

    // Itemized items state - for editing OCR items only
    const [editingItemIndex, setEditingItemIndex] = useState(null);
    const [editedItems, setEditedItems] = useState([]);

    // Mobile detection state
    const [isMobile, setIsMobile] = useState(false);

    // Camera modal state
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            setIsMobile(window.innerWidth <= 640);
        };

        handleResize(); // Initial check
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const fetchCategories = async () => {
        try {
            setLoadingCategories(true);
            const response = await axios.get("/api/categories?type=expense");
            setCategories(response.data);
        } catch (error) {
            console.error("Error fetching categories:", error);
            setCategories([
                { id: 1, category_name: "Food & Dining" },
                { id: 2, category_name: "Shopping" },
                { id: 3, category_name: "Entertainment" },
                { id: 4, category_name: "Bills & Utilities" },
                { id: 5, category_name: "Transportation" },
                { id: 6, category_name: "Other Expense" },
            ]);
        } finally {
            setLoadingCategories(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    };

    // Initialize edited items from OCR results
    useEffect(() => {
        if (ocrResults?.items && ocrResults.items.length > 0) {
            setEditedItems(
                ocrResults.items.map((item, index) => ({
                    ...item,
                    id: index,
                }))
            );
        }
    }, [ocrResults]);

    // OCR Items Edit Functions
    const handleEditOcrItem = (index) => {
        setEditingItemIndex(index);
    };

    const handleSaveOcrItem = (index, updatedItem) => {
        const newEditedItems = [...editedItems];
        newEditedItems[index] = {
            ...updatedItem,
            id: index,
        };
        setEditedItems(newEditedItems);
        setEditingItemIndex(null);

        // Recalculate total
        const newTotal = newEditedItems.reduce((total, item) => {
            const itemTotal =
                (parseInt(item.quantity) || 1) *
                (parseFloat(item.item_price) || 0);
            return total + itemTotal;
        }, 0);

        setFormData((prev) => ({ ...prev, amount: newTotal.toString() }));
    };

    const handleCancelEditOcr = () => {
        setEditingItemIndex(null);
    };

    const handleDeleteOcrItem = (index) => {
        const newEditedItems = editedItems.filter((_, i) => i !== index);
        setEditedItems(newEditedItems);

        // Recalculate total
        const newTotal = newEditedItems.reduce((total, item) => {
            const itemTotal =
                (parseInt(item.quantity) || 1) *
                (parseFloat(item.item_price) || 0);
            return total + itemTotal;
        }, 0);

        setFormData((prev) => ({ ...prev, amount: newTotal.toString() }));
    };

    // Image compression function to speed up camera photos
    const compressImage = (file, maxWidth = 1024, quality = 0.8) => {
        return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                const ratio = Math.min(
                    maxWidth / img.width,
                    maxWidth / img.height
                );
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;

                // Draw and compress the image
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Convert to compressed blob
                canvas.toBlob(
                    (blob) => {
                        // Create a new File object with the same name
                        const compressedFile = new File([blob], file.name, {
                            type: "image/jpeg",
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    "image/jpeg",
                    quality
                );
            };

            img.src = URL.createObjectURL(file);
        });
    };

    // Helper function to map OCR category to our API categories (multilingual)
    const mapToValidCategory = (ocrCategory, description = "") => {
        if (categories.length === 0) return null; // Return null if categories not loaded yet

        // Combine category and description for better matching
        const searchText = `${ocrCategory || ""} ${
            description || ""
        }`.toLowerCase();

        // Find matching category by name
        const findCategoryByKeywords = (keywords) => {
            return categories.find((cat) =>
                keywords.some(
                    (keyword) =>
                        cat.category_name.toLowerCase().includes(keyword) ||
                        searchText.includes(keyword)
                )
            );
        };

        // Food & Beverages mapping (English + Indonesian)
        const foodCategory = findCategoryByKeywords([
            "food",
            "beverage",
            "restaurant",
            "cafe",
            "grocery",
            "dining",
            "makanan",
            "minuman",
            "restoran",
            "warung",
            "kafe",
            "supermarket",
            "pasar",
            "indomaret",
            "alfamart",
            "hypermart",
            "giant",
            "carrefour",
            "hero",
            "lottemart",
            "mcdonald",
            "kfc",
            "pizza",
            "bakery",
            "roti",
            "bakso",
            "gado",
            "nasi",
            "ayam",
            "seafood",
            "kedai",
        ]);
        if (foodCategory) return foodCategory.id;

        // Shopping mapping (English + Indonesian + Electronics)
        const shoppingCategory = findCategoryByKeywords([
            "shop",
            "retail",
            "store",
            "clothing",
            "fashion",
            "belanja",
            "mall",
            "butik",
            "pakaian",
            "sepatu",
            "tas",
            "elektronik",
            "electronic",
            "gadget",
            "handphone",
            "laptop",
            "computer",
            "hp",
            "smartphone",
            "tablet",
            "accessories",
            "aksesoris",
        ]);
        if (shoppingCategory) return shoppingCategory.id;

        // Entertainment mapping (English + Indonesian)
        const entertainmentCategory = findCategoryByKeywords([
            "entertainment",
            "movie",
            "game",
            "cinema",
            "sports",
            "hiburan",
            "bioskop",
            "film",
            "olahraga",
            "permainan",
            "karaoke",
            "wisata",
            "cgv",
            "xxi",
            "cineplex",
            "fitness",
            "gym",
            "spa",
            "salon",
        ]);
        if (entertainmentCategory) return entertainmentCategory.id;

        // Bills & Utilities mapping (English + Indonesian)
        const billsCategory = findCategoryByKeywords([
            "utility",
            "electric",
            "water",
            "gas",
            "internet",
            "phone",
            "bill",
            "listrik",
            "air",
            "telepon",
            "tagihan",
            "pln",
            "pdam",
            "wifi",
            "pulsa",
            "telkom",
            "indihome",
        ]);
        if (billsCategory) return billsCategory.id;

        // Default to first category (usually "Other") if no match found
        return categories.length > 0
            ? categories[categories.length - 1].id
            : null;
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Check if image needs compression (>1MB or from camera)
        const needsCompression = file.size > 1024 * 1024; // 1MB threshold

        if (needsCompression) {
            try {
                console.log(
                    `Compressing image: ${(file.size / 1024 / 1024).toFixed(
                        2
                    )}MB`
                );
                const compressedFile = await compressImage(file);
                console.log(
                    `Compressed to: ${(
                        compressedFile.size /
                        1024 /
                        1024
                    ).toFixed(2)}MB`
                );
                setSelectedFile(compressedFile);
            } catch (error) {
                console.error("Compression failed, using original:", error);
                setSelectedFile(file);
            }
        } else {
            setSelectedFile(file);
        }

        // Reset results when new file is selected
        setOcrResults(null);
        setProcessingTime(null);
    };

    const handleScanReceipt = async () => {
        if (!selectedFile) return;

        setIsScanning(true);
        setOcrResults(null);

        try {
            // Get CSRF token
            const csrfToken = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute("content");

            if (!csrfToken) {
                throw new Error(
                    "CSRF token not found. Please refresh the page and try again."
                );
            }

            console.log("Starting OCR process with file:", {
                name: selectedFile.name,
                size: selectedFile.size,
                type: selectedFile.type,
            });

            const startTime = Date.now();

            // Create FormData to send the file to OCR endpoint
            const formData = new FormData();
            formData.append("image", selectedFile);

            // Send to /process-receipt endpoint (Gemini AI)
            const response = await fetch("/process-receipt", {
                method: "POST",
                headers: {
                    "X-CSRF-TOKEN": csrfToken,
                    "X-Requested-With": "XMLHttpRequest",
                    Accept: "application/json",
                },
                body: formData,
                credentials: "same-origin",
            });

            const endTime = Date.now();
            const processingTime = endTime - startTime;
            setProcessingTime(processingTime);

            // Get response
            const responseText = await response.text();
            console.log("Response status:", response.status);
            console.log("Response body:", responseText);

            if (!response.ok) {
                let errorMessage = "OCR processing failed";
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage =
                        errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    errorMessage += ` (Status: ${response.status})`;
                }
                throw new Error(errorMessage);
            }

            // Parse JSON response
            const ocrData = JSON.parse(responseText);

            // Check if there's an error from the backend
            if (ocrData.error || !ocrData.success) {
                throw new Error(ocrData.error || "Failed to process receipt");
            }

            console.log("OCR Data received:", ocrData);

            // Store the complete OCR results for display
            setOcrResults(ocrData);

            // Populate formData for editing
            setFormData({
                amount: ocrData.amount?.toString() || "",
                category: ocrData.category_id || "",
                date: ocrData.date || new Date().toISOString().split("T")[0],
                description: ocrData.description || "Receipt transaction",
            });

            // Show success message
            const itemCount = ocrData.items?.length || 0;
            const successMsg =
                itemCount > 0
                    ? `Receipt scanned successfully! Found ${itemCount} item${
                          itemCount > 1 ? "s" : ""
                      }. Review and edit before adding.`
                    : "Receipt scanned successfully! Review and edit before adding.";
            showMessage("success", successMsg);
        } catch (error) {
            console.error("OCR error:", error);
            showMessage("error", error.message || "Failed to process receipt");
            setOcrResults(null);
        } finally {
            setIsScanning(false);
        }
    };

    const handleInputChange = (field, value) => {
        if (field === "amount") {
            // Handle amount formatting
            const rawValue = parseFormattedNumber(value);
            setFormData((prev) => ({
                ...prev,
                [field]: rawValue,
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [field]: value,
            }));
        }
    };

    // Helper function to format date as DD/MM/YYYY for display
    const formatDateForDisplay = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();

        return `${day}/${month}/${year}`;
    };

    // Helper function to convert DD/MM/YYYY back to YYYY-MM-DD for input value
    const parseDateFromDisplay = (displayDate) => {
        if (!displayDate) return "";

        // If it's already in YYYY-MM-DD format, return as is
        if (displayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return displayDate;
        }

        // Parse DD/MM/YYYY format
        const parts = displayDate.split("/");
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }

        return displayDate;
    };

    // Helper function to truncate filename with responsive length based on screen size
    const truncateFilename = (filename) => {
        if (!filename) return "";

        // Dynamic max length based on current screen width
        const getMaxLength = () => {
            if (windowWidth >= 1536) return 50; // 2xl screens - show more
            if (windowWidth >= 1280) return 40; // xl screens
            if (windowWidth >= 1024) return 35; // lg screens
            if (windowWidth >= 768) return 30; // md screens
            if (windowWidth >= 640) return 25; // sm screens
            return 20; // xs screens - very tight
        };

        const maxLength = getMaxLength();

        if (filename.length <= maxLength) return filename;

        // Find the last dot for extension
        const lastDotIndex = filename.lastIndexOf(".");
        if (lastDotIndex === -1) {
            // No extension, just truncate
            return filename.substring(0, maxLength - 3) + "...";
        }

        const nameWithoutExt = filename.substring(0, lastDotIndex);
        const extension = filename.substring(lastDotIndex);

        // Calculate available space for name (total - extension - ellipsis)
        const availableSpace = maxLength - extension.length - 3;

        if (availableSpace <= 0) {
            // Extension is too long, just show extension
            return "..." + extension;
        }

        if (nameWithoutExt.length <= availableSpace) {
            return filename; // No truncation needed
        }

        // Truncate name and add ellipsis before extension
        return nameWithoutExt.substring(0, availableSpace) + "..." + extension;
    };

    const handleAddTransaction = async () => {
        if (!formData.amount || !formData.category || !formData.date) {
            showMessage(
                "error",
                "Please fill in all required fields (Amount, Category, Date)"
            );
            return;
        }

        setSubmitting(true);
        try {
            // Prepare data for API
            const transactionData = {
                category_id: parseInt(formData.category),
                amount: parseFloat(formData.amount),
                description: formData.description || "Receipt transaction",
                transaction_date: formData.date,
            };

            // Add transaction details (items) if they exist from OCR (use edited items)
            if (editedItems && editedItems.length > 0) {
                transactionData.transaction_details = editedItems.map(
                    (item) => ({
                        item_name: item.item_name,
                        quantity: parseInt(item.quantity) || 1,
                        item_price: parseFloat(item.item_price),
                        category_id: parseInt(formData.category), // Use selected category
                    })
                );
            }

            const response = await axios.post(
                "/api/transactions/add",
                transactionData
            );

            if (response.data.status === "success") {
                const itemCount = editedItems?.length || 0;
                const successMsg =
                    itemCount > 0
                        ? `Transaction with ${itemCount} item${
                              itemCount > 1 ? "s" : ""
                          } added successfully!`
                        : "Transaction added successfully from receipt!";
                showMessage("success", successMsg);

                // Check for budget alert in response
                if (response.data.budget_alert) {
                    const alert = response.data.budget_alert;
                    const alertMessage = `Budget Alert: ${
                        alert.message
                    } (${Math.floor(alert.percentage)}% of budget used)`;

                    // Show budget alert notification after success message
                    setTimeout(() => {
                        showMessage(
                            alert.alert_level === "critical"
                                ? "error"
                                : "warning",
                            alertMessage
                        );
                    }, 2000);
                }

                // Dispatch event for notification bell to refresh
                window.dispatchEvent(new CustomEvent('transaction-created'));

                // Reset form and clear selected file
                setFormData({
                    amount: "",
                    category: categories.length > 0 ? categories[0].id : "",
                    date: "",
                    description: "",
                });
                setOcrResults(null);
                setEditedItems([]);
                setSelectedFile(null);

                // Clear file input
                const fileInput = document.getElementById("receipt-file");
                const cameraInput = document.getElementById("camera-input");
                if (fileInput) fileInput.value = "";
                if (cameraInput) cameraInput.value = "";
            }
        } catch (error) {
            console.error("Error adding transaction:", error);

            if (error.response?.data?.errors) {
                const errors = Object.values(error.response.data.errors).flat();
                showMessage("error", errors.join(", "));
            } else if (error.response?.data?.message) {
                showMessage("error", error.response.data.message);
            } else {
                showMessage(
                    "error",
                    "Failed to add transaction. Please try again."
                );
            }
        } finally {
            setSubmitting(false);
        }
    };

    const openCameraOrFile = () => {
        // Check if device has camera capability
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Detect if mobile device
            const isMobileDevice =
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                    navigator.userAgent
                );

            if (isMobileDevice) {
                // Mobile: Use native camera input with capture attribute
                document.getElementById("camera-input").click();
            } else {
                // Desktop: Open camera modal with webcam preview
                openCameraModal();
            }
        } else {
            // No camera available, just open file picker
            document.getElementById("receipt-file").click();
        }
    };

    const handleCameraClick = () => {
        // Test camera availability first before opening
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Check for camera availability
            navigator.mediaDevices
                .getUserMedia({ video: true })
                .then(() => {
                    // Camera is available, proceed to open camera
                    showMessage("success", "Opening camera...");
                    setTimeout(() => {
                        openCameraOrFile();
                    }, 500); // Small delay to show message
                })
                .catch(() => {
                    // Camera not available/denied, fallback to file picker
                    showMessage(
                        "warning",
                        "No camera detected or permission denied. Opening file picker instead..."
                    );
                    setTimeout(() => {
                        document.getElementById("receipt-file").click();
                    }, 1000); // Show message longer before opening file picker
                });
        } else {
            // Browser doesn't support camera API
            showMessage(
                "warning",
                "Camera not supported on this browser. Opening file picker..."
            );
            setTimeout(() => {
                document.getElementById("receipt-file").click();
            }, 1000);
        }
    };

    // Open camera modal for desktop
    const openCameraModal = async () => {
        console.log('[Camera] Opening camera modal...');
        try {
            console.log('[Camera] Requesting camera access with optimized settings...');
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment', // Prefer back camera
                    width: { ideal: 1280 },  // Reduced from 1920 for faster init
                    height: { ideal: 720 }   // Reduced from 1080 for faster init
                } 
            });
            console.log('[Camera] Camera access granted, stream obtained');
            setCameraStream(stream);
            setShowCameraModal(true);
            console.log('[Camera] Modal state set to true');
            
            // Wait for modal to render, then set video source
            setTimeout(() => {
                if (videoRef.current) {
                    console.log('[Camera] Setting video source...');
                    videoRef.current.srcObject = stream;
                    console.log('[Camera] Video source set, camera ready');
                }
            }, 100);
        } catch (error) {
            console.error('[Camera] Error accessing camera:', error);
            alert('Unable to access camera. Please check permissions or use file upload instead.');
        }
    };

    // Close camera modal and stop stream
    const closeCameraModal = () => {
        console.log('[Camera] Close button clicked');
        
        // Stop all tracks immediately
        if (cameraStream) {
            console.log('[Camera] Stopping camera tracks...');
            cameraStream.getTracks().forEach(track => {
                track.stop();
            });
            console.log('[Camera] All tracks stopped');
        }
        
        // Stop video element and clear source
        if (videoRef.current) {
            console.log('[Camera] Clearing video element...');
            videoRef.current.srcObject = null;
            videoRef.current.pause();
            console.log('[Camera] Video element cleared');
        }
        
        // Close modal first
        console.log('[Camera] Setting modal state to false...');
        setShowCameraModal(false);
        console.log('[Camera] Modal should be closing now');
        
        // Then reset states with a small delay to ensure clean closure
        setTimeout(() => {
            console.log('[Camera] Resetting camera stream state');
            setCameraStream(null);
            if (videoRef.current) {
                videoRef.current.load(); // Reset video element completely
            }
            console.log('[Camera] Cleanup complete');
        }, 100);
    };

    // Capture photo from video stream
    const capturePhoto = async () => {
        console.log('[Camera] Capture Photo button clicked');
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        console.log('[Camera] Setting canvas dimensions...');
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        console.log('[Camera] Drawing video frame to canvas...');
        // Draw current video frame to canvas
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        console.log('[Camera] Frame captured to canvas');
        
        // Convert canvas to blob
        console.log('[Camera] Converting canvas to blob...');
        canvas.toBlob(async (blob) => {
            if (blob) {
                console.log('[Camera] Blob created, creating file...');
                // Create a File object from the blob
                const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { 
                    type: 'image/jpeg' 
                });
                
                console.log('[Camera] File created, size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
                
                // Compress if needed
                const needsCompression = file.size > 1024 * 1024;
                if (needsCompression) {
                    try {
                        console.log(`[Camera] Compressing captured image: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                        const compressedFile = await compressImage(file);
                        console.log(`[Camera] Compressed to: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
                        setSelectedFile(compressedFile);
                    } catch (error) {
                        console.error('[Camera] Compression failed, using original:', error);
                        setSelectedFile(file);
                    }
                } else {
                    console.log('[Camera] No compression needed, setting file...');
                    setSelectedFile(file);
                }
                
                // Reset results when new file is captured
                console.log('[Camera] Resetting OCR results...');
                setOcrResults(null);
                
                // Close modal
                console.log('[Camera] Calling closeCameraModal...');
                closeCameraModal();
            }
        }, 'image/jpeg', 0.92);
    };

    // Cleanup camera stream on unmount
    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [cameraStream]);

    // Drag and drop handlers
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging to false if we're leaving the drop zone entirely
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        const imageFile = files.find((file) => file.type.startsWith("image/"));

        if (imageFile) {
            // Use the same file processing logic as handleFileChange
            const needsCompression = imageFile.size > 1024 * 1024;

            if (needsCompression) {
                try {
                    console.log(
                        `Compressing image: ${(
                            imageFile.size /
                            1024 /
                            1024
                        ).toFixed(2)}MB`
                    );
                    const compressedFile = await compressImage(imageFile);
                    console.log(
                        `Compressed to: ${(
                            compressedFile.size /
                            1024 /
                            1024
                        ).toFixed(2)}MB`
                    );
                    setSelectedFile(compressedFile);
                } catch (error) {
                    console.error("Compression failed, using original:", error);
                    setSelectedFile(imageFile);
                }
            } else {
                setSelectedFile(imageFile);
            }

            // Reset results when new file is selected
            setOcrResults(null);
        } else {
            alert("Please drop an image file (PNG, JPG, or JPEG)");
        }
    };

    return (
        <AppLayout title="MONA - Scan Receipt" auth={auth}>
            {/* Keyframes for animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out;
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.8s ease-out forwards;
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.3s ease-out;
                }
                .delay-100 { animation-delay: 0.1s; opacity: 0; }
                .delay-200 { animation-delay: 0.2s; opacity: 0; }
                .delay-300 { animation-delay: 0.3s; opacity: 0; }

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

                    .react-datepicker__header {
                        padding: 10px 0 !important;
                    }

                    .react-datepicker__month {
                        padding: 6px 0 !important;
                    }
                }
            `}</style>

            {/* Floating Date Warning Notification */}
            {showDateWarning && (
                <div className="fixed top-4 right-4 z-[9999] animate-slide-in-right">
                    <div className="bg-white rounded-lg shadow-lg border-l-4 border-expense-red-500 p-4 max-w-sm">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                                <svg
                                    className="w-6 h-6 text-expense-red-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                    Can't Select Future Date
                                </h4>
                                <p className="text-sm text-gray-600">
                                    Please select today or a past date.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Content */}
            <div className="overflow-x-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Page Header */}
                    <div className="mb-8 animate-fade-in">
                        <h1 className="text-2xl sm:text-3xl md:text-3xl lg:text-3xl xl:text-4xl font-bold text-charcoal mb-2">
                            Scan Receipt
                        </h1>
                        <p className="text-sm sm:text-base md:text-base lg:text-base xl:text-lg text-medium-gray">
                            Scan receipts and automatically extract transaction
                            data
                        </p>

                        {/* Success/Error Message */}
                        {message.text && (
                            <div
                                className={`mt-4 p-4 rounded-lg ${
                                    message.type === "success"
                                        ? "bg-green-50 text-green-800 border border-green-200"
                                        : "bg-red-50 text-red-800 border border-red-200"
                                }`}
                            >
                                {message.text}
                            </div>
                        )}
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid lg:grid-cols-2 gap-8 mb-12">
                        {/* Upload Receipt Section */}
                        <div className="bg-white rounded-lg border border-light-gray p-6 animate-fade-in-up delay-100">
                            <h2 className="text-xl font-semibold text-charcoal mb-2">
                                Upload Receipt
                            </h2>
                            <p className="text-medium-gray mb-6">
                                Take a photo or upload an image of your receipt
                            </p>

                            {/* Upload Area */}
                            <div
                                className={`border-2 border-dashed rounded-lg p-4 text-center mb-6 min-h-[300px] flex flex-col justify-center transition-colors duration-200 ${
                                    isDragging
                                        ? "border-[#058743] bg-[#058743] bg-opacity-5"
                                        : "border-light-gray hover:border-[#058743] hover:bg-gray-50"
                                }`}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onClick={() =>
                                    document
                                        .getElementById("receipt-file")
                                        .click()
                                }
                                style={{ cursor: "pointer" }}
                            >
                                {selectedFile ? (
                                    // Show selected file preview
                                    <div>
                                        <div className="mb-4">
                                            <img
                                                src={URL.createObjectURL(
                                                    selectedFile
                                                )}
                                                alt="Receipt Preview"
                                                className="max-w-full max-h-[200px] mx-auto rounded border border-light-gray shadow-sm"
                                            />
                                        </div>
                                        <h3 className="text-lg font-medium text-[#058743] mb-1">
                                            File Selected
                                        </h3>
                                        <p
                                            className="text-charcoal font-medium mb-1 break-words"
                                            title={selectedFile.name}
                                        >
                                            {truncateFilename(
                                                selectedFile.name
                                            )}
                                        </p>
                                        <p className="text-medium-gray text-sm">
                                            {(
                                                selectedFile.size /
                                                1024 /
                                                1024
                                            ).toFixed(2)}{" "}
                                            MB
                                        </p>
                                    </div>
                                ) : (
                                    // Show upload prompt
                                    <div>
                                        <div className="mb-4">
                                            <img
                                                src="/images/icons/upload-icon.svg"
                                                alt="Upload Icon"
                                                className={`w-12 h-12 mx-auto transition-opacity duration-200 ${
                                                    isDragging
                                                        ? "opacity-70"
                                                        : "opacity-100"
                                                }`}
                                            />
                                        </div>
                                        <h3
                                            className={`text-lg font-medium mb-2 transition-colors duration-200 ${
                                                isDragging
                                                    ? "text-[#058743]"
                                                    : "text-charcoal"
                                            }`}
                                        >
                                            {isDragging
                                                ? "Drop your receipt here"
                                                : "Upload Photo"}
                                        </h3>
                                        <p className="text-medium-gray text-sm mb-3">
                                            {isDragging
                                                ? "Release to upload your receipt"
                                                : "Drag & drop or click to browse • PNG, JPG, or JPEG up to 10 MB"}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* File Input Section */}
                            <div className="mb-2">
                                {/* Camera and Browse buttons side by side */}
                                <div className="flex gap-3 mb-4">
                                    {/* Hidden file inputs */}
                                    <input
                                        type="file"
                                        id="receipt-file"
                                        accept="image/png,image/jpeg,image/jpg"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <input
                                        type="file"
                                        id="camera-input"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />

                                    <button
                                        type="button"
                                        onClick={handleCameraClick}
                                        className="flex-1 px-4 py-2 border border-[#058743] text-[#058743] rounded hover:bg-[#058743] hover:text-white transition-colors duration-200 flex items-center justify-center gap-2 group"
                                    >
                                        {/* Green camera icon (default) */}
                                        <img
                                            src="/images/icons/green-camera-icon.svg"
                                            alt="Camera Icon"
                                            className="w-4 h-4 group-hover:hidden"
                                        />
                                        {/* White/original camera icon (hover) */}
                                        <img
                                            src="/images/icons/camera-icon.svg"
                                            alt="Camera Icon"
                                            className="w-4 h-4 hidden group-hover:block"
                                        />
                                        Camera
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            document
                                                .getElementById("receipt-file")
                                                .click()
                                        }
                                        className="flex-1 px-4 py-2 border border-medium-gray text-medium-gray rounded hover:bg-medium-gray hover:text-white transition-colors duration-200 flex items-center justify-center gap-2"
                                    >
                                        Browse
                                    </button>
                                </div>

                                {/* Scan Receipt button at the bottom */}
                                <button
                                    type="button"
                                    onClick={handleScanReceipt}
                                    disabled={!selectedFile || isScanning}
                                    className={`w-full px-6 py-3 rounded transition-colors duration-200 flex items-center justify-center gap-2 font-medium ${
                                        selectedFile && !isScanning
                                            ? "bg-[#058743] text-white hover:bg-[#046635] cursor-pointer"
                                            : "bg-black bg-opacity-20 text-gray-500 cursor-not-allowed"
                                    }`}
                                >
                                    {isScanning ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            Scanning...
                                        </>
                                    ) : (
                                        <>
                                            <img
                                                src="/images/icons/scan-white-icon.svg"
                                                alt="Scan Icon"
                                                className={`w-5 h-5 ${
                                                    !selectedFile
                                                        ? "opacity-50"
                                                        : ""
                                                }`}
                                            />
                                            Scan Receipt
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Extracted Data Section */}
                        <div className="bg-white rounded-lg border border-[#E0E0E0] p-6 animate-fade-in-up delay-200">
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="text-xl font-semibold text-[#2C2C2C]">
                                    Extracted Data
                                </h2>
                                {processingTime && (
                                    <span className="text-sm text-[#757575] bg-gray-100 px-2 py-1 rounded">
                                        Processed in {processingTime}ms
                                    </span>
                                )}
                            </div>
                            <p className="text-[#757575] mb-6">
                                Review the Scanned Information
                            </p>{" "}
                            {isScanning ? (
                                /* Loading State */
                                <div className="text-center py-12">
                                    <div className="mb-4">
                                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#058743] mx-auto"></div>
                                    </div>
                                    <p className="text-medium-gray mb-2">
                                        Processing receipt...
                                    </p>
                                    <p className="text-medium-gray text-sm">
                                        Please wait while we extract the data
                                    </p>
                                </div>
                            ) : ocrResults ? (
                                /* OCR Results Form - Editable */
                                <div className="space-y-4">
                                    {/* Amount Field */}
                                    <div>
                                        <label className="block text-charcoal font-medium mb-2">
                                            Amount
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formatNumberWithDots(
                                                formData.amount
                                            )}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "amount",
                                                    e.target.value
                                                )
                                            }
                                            className="w-full px-3 py-2 border border-light-gray rounded text-charcoal focus:ring-2 focus:ring-growth-green-500 focus:border-transparent"
                                            placeholder="0"
                                        />
                                    </div>

                                    {/* Category Field */}
                                    <div>
                                        <label className="block text-charcoal font-medium mb-2">
                                            Category
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={formData.category}
                                                onChange={(e) =>
                                                    handleInputChange(
                                                        "category",
                                                        e.target.value
                                                    )
                                                }
                                                onFocus={() =>
                                                    setIsDropdownOpen(true)
                                                }
                                                onBlur={() =>
                                                    setIsDropdownOpen(false)
                                                }
                                                className="w-full px-3 py-2 border border-light-gray rounded text-charcoal cursor-pointer pr-10 focus:ring-2 focus:ring-growth-green-500 focus:border-transparent"
                                                disabled={loadingCategories}
                                                style={{
                                                    WebkitAppearance: "none",
                                                    MozAppearance: "none",
                                                    appearance: "none",
                                                    backgroundImage: "none",
                                                }}
                                            >
                                                <option value="">
                                                    {loadingCategories
                                                        ? "Loading categories..."
                                                        : "Select a category"}
                                                </option>
                                                {categories.map((category) => (
                                                    <option
                                                        key={category.id}
                                                        value={category.id}
                                                    >
                                                        {category.category_name}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                                                <img
                                                    src={
                                                        isDropdownOpen
                                                            ? "/images/icons/dropdown-up-icon.svg"
                                                            : "/images/icons/dropdown-down-icon.svg"
                                                    }
                                                    alt="Dropdown Icon"
                                                    className="w-4 h-4"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Date Field */}
                                    <div>
                                        <label className="block text-charcoal font-medium mb-2">
                                            Date
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <div className="relative">
                                            <DatePicker
                                                selected={
                                                    formData.date
                                                        ? new Date(
                                                              formData.date
                                                          )
                                                        : null
                                                }
                                                onChange={(date) => {
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    const selectedDate =
                                                        new Date(date);
                                                    selectedDate.setHours(
                                                        0,
                                                        0,
                                                        0,
                                                        0
                                                    );

                                                    if (selectedDate > today) {
                                                        // Show warning for future dates
                                                        setShowDateWarning(
                                                            true
                                                        );
                                                        setTimeout(
                                                            () =>
                                                                setShowDateWarning(
                                                                    false
                                                                ),
                                                            3000
                                                        );
                                                    } else {
                                                        const formattedDate =
                                                            date
                                                                ? date
                                                                      .toISOString()
                                                                      .split(
                                                                          "T"
                                                                      )[0]
                                                                : "";
                                                        handleInputChange(
                                                            "date",
                                                            formattedDate
                                                        );
                                                    }
                                                }}
                                                dateFormat="dd/MM/yyyy"
                                                className="w-full px-3 py-2 border border-light-gray rounded text-charcoal bg-gray-100 cursor-pointer focus:ring-2 focus:ring-[#058743] focus:border-transparent"
                                                calendarClassName="custom-calendar"
                                                wrapperClassName="w-full"
                                                placeholderText="DD/MM/YYYY"
                                                showPopperArrow={false}
                                                onKeyDown={(e) => {
                                                    // Prevent all keyboard input except Tab for accessibility
                                                    if (e.key !== "Tab") {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onChangeRaw={(e) =>
                                                    e.preventDefault()
                                                }
                                                dayClassName={(date) => {
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    const checkDate = new Date(
                                                        date
                                                    );
                                                    checkDate.setHours(
                                                        0,
                                                        0,
                                                        0,
                                                        0
                                                    );

                                                    return checkDate > today
                                                        ? "future-date"
                                                        : undefined;
                                                }}
                                            />
                                            {/* Calendar icon */}
                                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                                                <svg
                                                    className="w-4 h-4 text-gray-400"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description Field */}
                                    <div>
                                        <label className="block text-charcoal font-medium mb-2">
                                            Description
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.description}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    "description",
                                                    e.target.value
                                                )
                                            }
                                            className="w-full px-3 py-2 border border-light-gray rounded text-charcoal focus:ring-2 focus:ring-growth-green-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* OCR Detected Items - Editable */}
                                    {ocrResults?.items &&
                                        ocrResults.items.length > 0 &&
                                        editedItems.length > 0 && (
                                            <div className="border-t border-gray-200 pt-4 mt-4">
                                                <div className="mb-3">
                                                    <label className="block text-charcoal font-medium mb-1">
                                                        Receipt Items (
                                                        {editedItems.length}{" "}
                                                        items)
                                                    </label>
                                                    <p className="text-xs text-gray-500">
                                                        Edit items to fix any
                                                        OCR reading errors
                                                    </p>
                                                </div>

                                                <div className="space-y-2">
                                                    {editedItems.map(
                                                        (item, index) => (
                                                            <div key={index}>
                                                                {editingItemIndex ===
                                                                index ? (
                                                                    /* Edit Mode */
                                                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <span className="text-xs font-semibold text-blue-700">
                                                                                Edit
                                                                                Item
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={
                                                                                    handleCancelEditOcr
                                                                                }
                                                                                className="text-xs text-gray-500 hover:text-gray-700"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>

                                                                        {/* Item Name */}
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Item name"
                                                                            defaultValue={
                                                                                item.item_name
                                                                            }
                                                                            onChange={(
                                                                                e
                                                                            ) => {
                                                                                const newItems =
                                                                                    [
                                                                                        ...editedItems,
                                                                                    ];
                                                                                newItems[
                                                                                    index
                                                                                ] =
                                                                                    {
                                                                                        ...newItems[
                                                                                            index
                                                                                        ],
                                                                                        item_name:
                                                                                            e
                                                                                                .target
                                                                                                .value,
                                                                                    };
                                                                                setEditedItems(
                                                                                    newItems
                                                                                );
                                                                            }}
                                                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                        />

                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            {/* Quantity */}
                                                                            <input
                                                                                type="number"
                                                                                placeholder="Qty"
                                                                                defaultValue={
                                                                                    item.quantity ||
                                                                                    1
                                                                                }
                                                                                onChange={(
                                                                                    e
                                                                                ) => {
                                                                                    const newItems =
                                                                                        [
                                                                                            ...editedItems,
                                                                                        ];
                                                                                    newItems[
                                                                                        index
                                                                                    ] =
                                                                                        {
                                                                                            ...newItems[
                                                                                                index
                                                                                            ],
                                                                                            quantity:
                                                                                                e
                                                                                                    .target
                                                                                                    .value,
                                                                                        };
                                                                                    setEditedItems(
                                                                                        newItems
                                                                                    );
                                                                                }}
                                                                                min="1"
                                                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                            />

                                                                            {/* Price */}
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Price"
                                                                                defaultValue={formatNumberWithDots(
                                                                                    item.item_price?.toString() ||
                                                                                        "0"
                                                                                )}
                                                                                onChange={(
                                                                                    e
                                                                                ) => {
                                                                                    const rawValue =
                                                                                        parseFormattedNumber(
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                        );
                                                                                    const newItems =
                                                                                        [
                                                                                            ...editedItems,
                                                                                        ];
                                                                                    newItems[
                                                                                        index
                                                                                    ] =
                                                                                        {
                                                                                            ...newItems[
                                                                                                index
                                                                                            ],
                                                                                            item_price:
                                                                                                rawValue,
                                                                                        };
                                                                                    setEditedItems(
                                                                                        newItems
                                                                                    );
                                                                                }}
                                                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                            />
                                                                        </div>

                                                                        {/* Subtotal Preview */}
                                                                        <div className="text-right text-xs text-gray-600 font-medium">
                                                                            Subtotal:{" "}
                                                                            {formatNumberWithDots(
                                                                                (
                                                                                    (parseInt(
                                                                                        item.quantity
                                                                                    ) ||
                                                                                        1) *
                                                                                    (parseFloat(
                                                                                        item.item_price
                                                                                    ) ||
                                                                                        0)
                                                                                ).toString()
                                                                            )}
                                                                        </div>

                                                                        {/* Save Button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleSaveOcrItem(
                                                                                    index,
                                                                                    editedItems[
                                                                                        index
                                                                                    ]
                                                                                )
                                                                            }
                                                                            className="w-full py-2 px-4 bg-growth-green-500 text-white text-sm font-medium rounded hover:bg-growth-green-600 transition-colors"
                                                                        >
                                                                            ✓
                                                                            Save
                                                                            Changes
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    /* View Mode */
                                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex-1">
                                                                                <p className="text-sm font-semibold text-gray-800">
                                                                                    {
                                                                                        item.item_name
                                                                                    }
                                                                                </p>
                                                                                <p className="text-xs text-gray-600 mt-1">
                                                                                    {item.quantity ||
                                                                                        1}{" "}
                                                                                    ×{" "}
                                                                                    {formatNumberWithDots(
                                                                                        item.item_price?.toString() ||
                                                                                            "0"
                                                                                    )}{" "}
                                                                                    ={" "}
                                                                                    <span className="font-semibold text-growth-green-600">
                                                                                        {formatNumberWithDots(
                                                                                            (
                                                                                                (parseInt(
                                                                                                    item.quantity
                                                                                                ) ||
                                                                                                    1) *
                                                                                                (parseFloat(
                                                                                                    item.item_price
                                                                                                ) ||
                                                                                                    0)
                                                                                            ).toString()
                                                                                        )}
                                                                                    </span>
                                                                                </p>
                                                                            </div>
                                                                            <div className="flex gap-2 ml-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        handleEditOcrItem(
                                                                                            index
                                                                                        )
                                                                                    }
                                                                                    className="text-blue-500 hover:text-blue-700 text-xs p-1"
                                                                                    title="Edit"
                                                                                >
                                                                                    <svg
                                                                                        className="w-4 h-4"
                                                                                        fill="none"
                                                                                        stroke="currentColor"
                                                                                        viewBox="0 0 24 24"
                                                                                    >
                                                                                        <path
                                                                                            strokeLinecap="round"
                                                                                            strokeLinejoin="round"
                                                                                            strokeWidth={
                                                                                                2
                                                                                            }
                                                                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                                                        />
                                                                                    </svg>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        handleDeleteOcrItem(
                                                                                            index
                                                                                        )
                                                                                    }
                                                                                    className="text-red-500 hover:text-red-700 text-xs p-1"
                                                                                    title="Delete"
                                                                                >
                                                                                    <svg
                                                                                        className="w-4 h-4"
                                                                                        fill="none"
                                                                                        stroke="currentColor"
                                                                                        viewBox="0 0 24 24"
                                                                                    >
                                                                                        <path
                                                                                            strokeLinecap="round"
                                                                                            strokeLinejoin="round"
                                                                                            strokeWidth={
                                                                                                2
                                                                                            }
                                                                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                                                        />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                                </div>

                                                {/* Total Amount */}
                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                    <div className="flex justify-between items-center font-semibold text-gray-700">
                                                        <span>Total:</span>
                                                        <span className="text-lg text-growth-green-500">
                                                            {formatNumberWithDots(
                                                                editedItems
                                                                    .reduce(
                                                                        (
                                                                            total,
                                                                            item
                                                                        ) => {
                                                                            const itemTotal =
                                                                                (parseInt(
                                                                                    item.quantity
                                                                                ) ||
                                                                                    1) *
                                                                                (parseFloat(
                                                                                    item.item_price
                                                                                ) ||
                                                                                    0);
                                                                            return (
                                                                                total +
                                                                                itemTotal
                                                                            );
                                                                        },
                                                                        0
                                                                    )
                                                                    .toString()
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    {/* Info Message */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="flex items-start gap-2 text-blue-700">
                                            <svg
                                                className="w-5 h-5 mt-0.5 flex-shrink-0"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <div className="flex-1">
                                                <span className="font-medium">
                                                    Review and edit the
                                                    extracted data
                                                </span>
                                                <p className="text-sm text-blue-600 mt-1">
                                                    You can modify the amount,
                                                    category, date, or
                                                    description before adding
                                                    the transaction.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Add Transaction Button */}
                                    <button
                                        type="button"
                                        onClick={handleAddTransaction}
                                        disabled={
                                            submitting || loadingCategories
                                        }
                                        className={`w-full px-6 py-3 rounded transition-colors duration-200 font-medium flex items-center justify-center gap-2 ${
                                            submitting || loadingCategories
                                                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                                                : "bg-black text-white hover:bg-gray-800"
                                        }`}
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                Adding Transaction...
                                            </>
                                        ) : (
                                            "Add Transaction"
                                        )}
                                    </button>

                                    {/* Scan Another Receipt Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedFile(null);
                                            setOcrResults(null);
                                            setProcessingTime(null);
                                            setFormData({
                                                amount: "",
                                                category: "Other",
                                                date: "",
                                                description: "",
                                            });
                                        }}
                                        className="w-full px-6 py-3 rounded transition-colors duration-200 font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
                                    >
                                        Scan Another Receipt
                                    </button>
                                </div>
                            ) : (
                                /* Empty State */
                                <div className="text-center py-12">
                                    <div className="mb-4">
                                        <img
                                            src="/images/icons/document-scan-icon.svg"
                                            alt="Document Icon"
                                            className="w-16 h-16 mx-auto"
                                        />
                                    </div>
                                    <p className="text-medium-gray">
                                        Upload or scan a receipt to see the
                                        results
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* How OCR Works Section */}
                    <div className="bg-white rounded-lg border border-light-gray p-8">
                        <h2 className="text-2xl font-semibold text-charcoal mb-8 text-center">
                            How OCR Works
                        </h2>

                        <div className="grid md:grid-cols-3 gap-8">
                            {/* Step 1: Upload */}
                            <div className="text-center">
                                <div className="mb-4">
                                    <img
                                        src="/images/icons/upload-icon.svg"
                                        alt="Upload Icon"
                                        className="w-16 h-16 mx-auto"
                                    />
                                </div>
                                <h3 className="text-lg font-semibold text-charcoal mb-2">
                                    1. Upload
                                </h3>
                                <p className="text-medium-gray text-sm">
                                    Take a photo or upload an image of your
                                    receipt
                                </p>
                            </div>

                            {/* Step 2: Scan */}
                            <div className="text-center">
                                <div className="mb-4">
                                    <img
                                        src="/images/icons/scan-gold-icon.svg"
                                        alt="Scan Icon"
                                        className="w-16 h-16 mx-auto"
                                    />
                                </div>
                                <h3 className="text-lg font-semibold text-charcoal mb-2">
                                    2. Scan
                                </h3>
                                <p className="text-medium-gray text-sm">
                                    AI extracts text and identifies key
                                    information
                                </p>
                            </div>

                            {/* Step 3: Save */}
                            <div className="text-center">
                                <div className="mb-4">
                                    <img
                                        src="/images/icons/checkmark-save-icon.svg"
                                        alt="Save Icon"
                                        className="w-16 h-16 mx-auto"
                                    />
                                </div>
                                <h3 className="text-lg font-semibold text-charcoal mb-2">
                                    3. Save
                                </h3>
                                <p className="text-medium-gray text-sm">
                                    Review and automatically add to your
                                    transactions
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Camera Modal for Desktop */}
                    {showCameraModal && (
                        <div
                            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
                            onClick={closeCameraModal}
                        >
                            <div
                                className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-semibold text-gray-800">
                                        Take Photo
                                    </h3>
                                    <button
                                        onClick={closeCameraModal}
                                        className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="relative bg-black rounded-lg overflow-hidden">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        className="w-full h-auto"
                                    />
                                </div>

                                <div className="mt-4 flex justify-center gap-4">
                                    <button
                                        onClick={capturePhoto}
                                        className="px-6 py-3 bg-[#28a745] text-white rounded-lg hover:bg-[#218838] transition-colors font-medium flex items-center gap-2"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        Capture Photo
                                    </button>
                                    <button
                                        onClick={closeCameraModal}
                                        className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                {/* Hidden canvas for capturing photo */}
                                <canvas
                                    ref={canvasRef}
                                    style={{ display: "none" }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
