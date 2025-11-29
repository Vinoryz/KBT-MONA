import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function FloatingChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'bot',
            content: 'Hello! How can I help you today?'
        }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const chatboxRef = useRef(null);

    const quickQuestions = [
        "How can I reduce my monthly expenses?",
        "Should I invest or pay off debt first?",
        "How much should I budget for entertainment?"
    ];

    // Close chatbox when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (chatboxRef.current && !chatboxRef.current.contains(event.target) && isOpen && !isClosing) {
                handleClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, isClosing]);

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 290);
    };

    // --- BAGIAN UTAMA YANG DIREFACTOR ---
    const submitQuestion = async (question) => {
        if (loading) return;

        // 1. Tambahkan pesan pengguna ke UI
        const userMessage = {
            id: Date.now(),
            type: 'user',
            content: question
        };
        setMessages(prev => [...prev, userMessage]);
        setLoading(true);

        try {
            // 2. Panggil API sesuai Route & Controller Laravel yang baru
            // Route: /api/chat-ai
            // Body: { message: "..." }
            const response = await axios.post('/api/chat-ai', {
                message: question, 
            });

            // 3. Parsing Response
            // Karena Controller me-return raw JSON dari Qwen, kita harus ambil content-nya.
            // Struktur umum LLM response (OpenAI format): data.choices[0].message.content
            const data = response.data;
            
            let botResponseContent = '';

            // Cek struktur response (Safety check)
            if (data.choices && data.choices[0] && data.choices[0].message) {
                botResponseContent = data.choices[0].message.content;
            } else if (data.data) {
                // Kadang wrapper axios menaruhnya di data.data tergantung setup interceptor
                botResponseContent = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
            } else {
                // Fallback jika struktur berbeda, tampilkan JSON string agar bisa didebug
                botResponseContent = typeof data === 'string' ? data : JSON.stringify(data);
            }

            const botMessage = {
                id: Date.now() + 1,
                type: 'bot',
                content: botResponseContent
            };
            setMessages(prev => [...prev, botMessage]);

        } catch (err) {
            console.error(err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to connect to Senopati API service';
            const errorBotMessage = {
                id: Date.now() + 1,
                type: 'bot',
                content: `Error: ${errorMessage}`
            };
            setMessages(prev => [...prev, errorBotMessage]);
        } finally {
            setLoading(false);
        }
    };
    // ------------------------------------

    const handleSendMessage = (e) => {
        e.preventDefault();
        const question = inputMessage.trim();
        if (!question) return;

        submitQuestion(question);
        setInputMessage('');
    };

    const handleQuickQuestion = (question) => {
        submitQuestion(question);
    };

    // ... (SISA KODE UI/RETURN DI BAWAH INI SAMA PERSIS SEPERTI SEBELUMNYA) ...
    return (
        <>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUpFade {
                    from { 
                        opacity: 0; 
                        transform: translateY(20px) scale(0.95);
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0) scale(1);
                    }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes slideDownFade {
                    from { 
                        opacity: 1; 
                        transform: translateY(0) scale(1);
                    }
                    to { 
                        opacity: 0; 
                        transform: translateY(20px) scale(0.95);
                    }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out;
                }
                .animate-slide-up-fade {
                    animation: slideUpFade 0.3s ease-out;
                }
                .animate-fade-out {
                    animation: fadeOut 0.3s ease-in;
                }
                .animate-slide-down-fade {
                    animation: slideDownFade 0.3s ease-in;
                }
            `}</style>
            
            {/* Dark Overlay */}
            {(isOpen || isClosing) && (
                <div className={`fixed inset-0 bg-black bg-opacity-30 z-40 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}></div>
            )}

            {/* Chat Window */}
            {(isOpen || isClosing) && (
                <div 
                    ref={chatboxRef}
                    className={`fixed 
                        bottom-4 max-[768px]:bottom-3 max-[425px]:bottom-2 max-[375px]:bottom-1 max-[320px]:bottom-1
                        right-4 max-[768px]:right-3 max-[425px]:right-2 max-[375px]:right-1 max-[320px]:right-1
                        max-[425px]:left-2 max-[375px]:left-1 max-[320px]:left-1
                        w-[500px] max-[768px]:w-[400px] max-[425px]:w-auto max-[375px]:w-auto max-[320px]:w-auto
                        h-[700px] max-[768px]:h-[560px]
                        bg-white 
                        rounded-2xl max-[768px]:rounded-xl max-[425px]:rounded-lg
                        shadow-2xl
                        border border-gray-200
                        z-50 flex flex-col ${isClosing ? 'animate-slide-down-fade' : 'animate-slide-up-fade'}`}
                >
                    {/* Header */}
                    <div className="bg-[#058743] text-white px-6 max-[768px]:px-5 max-[425px]:px-4 py-4 max-[768px]:py-3 max-[425px]:py-2.5 rounded-t-2xl max-[768px]:rounded-t-xl max-[425px]:rounded-t-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-xl max-[768px]:text-lg max-[425px]:text-base">AI Assistant</h3>
                            <button
                                onClick={handleClose}
                                className="text-white hover:text-gray-200 text-4xl max-[768px]:text-3xl max-[425px]:text-2xl font-bold w-6 h-6 max-[425px]:w-5 max-[425px]:h-5 flex items-center justify-center"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Left Sidebar - Tips and Quick Questions */}
                        <div className="w-48 max-[768px]:w-40 max-[425px]:w-32 max-[375px]:w-28 max-[320px]:w-24 p-4 max-[768px]:p-3 max-[425px]:p-2 max-[375px]:p-1.5 max-[320px]:p-1 border-r border-gray-200 flex flex-col">
                            {/* Tips Section */}
                            <div className="space-y-3 mb-6">
                                {/* Tip Card */}
                                <div className="bg-[#D4EADF] rounded-xl max-[425px]:rounded-lg max-[375px]:rounded-md p-3 max-[768px]:p-2 max-[425px]:p-1.5 max-[375px]:p-1 max-[320px]:p-0.5">
                                    <div className="flex items-center mb-2 max-[425px]:mb-1 max-[375px]:mb-0.5">
                                        <svg className="w-4 h-4 max-[768px]:w-3 max-[768px]:h-3 max-[425px]:w-2.5 max-[425px]:h-2.5 max-[375px]:w-2 max-[375px]:h-2 text-[#058743] mr-2 max-[425px]:mr-1 max-[375px]:mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                                        </svg>
                                        <span className="text-[#058743] font-bold text-sm max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs max-[320px]:text-xs">Tip</span>
                                    </div>
                                    <p className="text-[#058743] text-xs max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs max-[320px]:text-xs font-medium">Automate your Savings</p>
                                </div>

                                {/* Smart Card */}
                                <div className="bg-[#FCF0C8] rounded-xl max-[425px]:rounded-lg max-[375px]:rounded-md p-3 max-[768px]:p-2 max-[425px]:p-1.5 max-[375px]:p-1 max-[320px]:p-0.5">
                                    <div className="flex items-center mb-2 max-[425px]:mb-1 max-[375px]:mb-0.5">
                                        <span className="text-[#EFBF04] font-bold text-sm max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs max-[320px]:text-xs mr-1 max-[375px]:mr-0.5">$</span>
                                        <span className="text-[#EFBF04] font-bold text-sm max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs max-[320px]:text-xs">Smart</span>
                                    </div>
                                    <p className="text-[#EFBF04] text-xs max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs max-[320px]:text-xs font-medium">24 Hour Rule for big purchase</p>
                                </div>
                            </div>

                            {/* Quick Questions */}
                            <div className="flex-1">
                                <p className="text-gray-900 font-semibold mb-3 max-[425px]:mb-2 max-[375px]:mb-1 text-sm max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs max-[320px]:text-xs">Quick Questions</p>
                                <div className="space-y-2 max-[425px]:space-y-1">
                                    {quickQuestions.map((question, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleQuickQuestion(question)}
                                            className="w-full text-left text-xs max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs max-[320px]:text-xs text-gray-600 hover:text-[#058743] transition-colors py-1 max-[425px]:py-0.5 rounded hover:bg-gray-50"
                                        >
                                            {question}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Messages */}
                        <div className="flex-1 flex flex-col">

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 max-[768px]:p-3 max-[425px]:p-2">
                                <div className="flex items-start mb-4 max-[425px]:mb-3 max-[375px]:mb-2">
                                    <div className="w-8 h-8 max-[768px]:w-6 max-[768px]:h-6 max-[425px]:w-5 max-[425px]:h-5 max-[375px]:w-4 max-[375px]:h-4 rounded-full bg-[#058743] flex items-center justify-center mr-3 max-[425px]:mr-2 max-[375px]:mr-1.5 flex-shrink-0">
                                        <img 
                                            src="/images/icons/ai_chatbot_profile.svg" 
                                            alt="AI Assistant" 
                                            className="w-5 h-5 max-[768px]:w-4 max-[768px]:h-4 max-[425px]:w-3 max-[425px]:h-3 max-[375px]:w-2.5 max-[375px]:h-2.5"
                                        />
                                    </div>
                                    <div className="bg-[#E5E7EB] rounded-2xl max-[425px]:rounded-xl max-[375px]:rounded-lg rounded-tl-md px-3 max-[425px]:px-2 max-[375px]:px-1.5 py-2 max-[425px]:py-1.5 max-[375px]:py-1 max-w-xs max-[425px]:max-w-[250px] max-[375px]:max-w-[200px] max-[320px]:max-w-[180px]">
                                        <p className="text-gray-700 text-sm max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs max-[320px]:text-xs">Hello! How can I help you today?</p>
                                    </div>
                                </div>
                                
                                {messages.slice(1).map((message) => (
                                    <div key={message.id} className={`flex mb-3 max-[425px]:mb-2 max-[375px]:mb-1.5 ${message.type === 'user' ? 'justify-end' : 'items-start'}`}>
                                        {message.type === 'bot' && (
                                            <div className="w-8 h-8 max-[768px]:w-6 max-[768px]:h-6 max-[425px]:w-5 max-[425px]:h-5 max-[375px]:w-4 max-[375px]:h-4 rounded-full bg-[#058743] flex items-center justify-center mr-3 max-[425px]:mr-2 max-[375px]:mr-1.5 flex-shrink-0">
                                                <img 
                                                    src="/images/icons/ai_chatbot_profile.svg" 
                                                    alt="AI Assistant" 
                                                    className="w-5 h-5 max-[768px]:w-4 max-[768px]:h-4 max-[425px]:w-3 max-[425px]:h-3 max-[375px]:w-2.5 max-[375px]:h-2.5"
                                                />
                                            </div>
                                        )}
                                        <div className={`px-3 max-[425px]:px-2 max-[375px]:px-1.5 py-2 max-[425px]:py-1.5 max-[375px]:py-1 rounded-2xl max-[425px]:rounded-xl max-[375px]:rounded-lg max-w-xs max-[425px]:max-w-[250px] max-[375px]:max-w-[200px] max-[320px]:max-w-[180px] ${
                                            message.type === 'user' 
                                                ? 'bg-[#058743] text-white rounded-tr-md' 
                                                : 'bg-[#E5E7EB] text-gray-700 rounded-tl-md'
                                        }`}>
                                            <p className="text-sm max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs max-[320px]:text-xs whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                    </div>
                                ))}

                                {loading && (
                                    <div className="flex items-start mb-4 max-[425px]:mb-3 max-[375px]:mb-2">
                                        <div className="w-8 h-8 max-[768px]:w-6 max-[768px]:h-6 max-[425px]:w-5 max-[425px]:h-5 max-[375px]:w-4 max-[375px]:h-4 rounded-full bg-[#058743] flex items-center justify-center mr-3 max-[425px]:mr-2 max-[375px]:mr-1.5 flex-shrink-0">
                                            <img 
                                                src="/images/icons/ai_chatbot_profile.svg" 
                                                alt="AI Assistant" 
                                                className="w-5 h-5 max-[768px]:w-4 max-[768px]:h-4 max-[425px]:w-3 max-[425px]:h-3 max-[375px]:w-2.5 max-[375px]:h-2.5"
                                            />
                                        </div>
                                        <div className="bg-[#E5E7EB] rounded-2xl max-[425px]:rounded-xl max-[375px]:rounded-lg rounded-tl-md px-3 max-[425px]:px-2 max-[375px]:px-1.5 py-2 max-[425px]:py-1.5 max-[375px]:py-1">
                                            <div className="flex space-x-1 p-1">
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sticky Input at Bottom */}
                            <div className="border-t border-gray-200 p-4 max-[768px]:p-3 max-[425px]:p-2">
                                <form onSubmit={handleSendMessage} className="flex space-x-3 max-[425px]:space-x-2 max-[375px]:space-x-1.5">
                                    <input
                                        type="text"
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        placeholder="Ask me about your finance"
                                        disabled={loading}
                                        className="flex-1 px-4 max-[768px]:px-3 max-[425px]:px-2 max-[375px]:px-1.5 py-3 max-[768px]:py-2.5 max-[425px]:py-2 max-[375px]:py-1.5 border border-gray-300 rounded-xl max-[425px]:rounded-lg max-[375px]:rounded-md text-sm max-[768px]:text-xs max-[425px]:text-xs max-[375px]:text-xs focus:outline-none focus:ring-2 focus:ring-[#058743] focus:border-transparent"
                                    />
                                    <button
                                        type="submit"
                                        className="bg-[#058743] text-white p-3 max-[768px]:p-2.5 max-[425px]:p-2 max-[375px]:p-1.5 rounded-xl max-[425px]:rounded-lg max-[375px]:rounded-md hover:bg-[#046635] transition-colors flex items-center justify-center"
                                    >
                                        {loading ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white max-[768px]:w-4 max-[768px]:h-4 max-[425px]:w-3.5 max-[425px]:h-3.5 max-[375px]:w-3 max-[375px]:h-3"></div>
                                        ) : (
                                            <svg className="w-5 h-5 max-[768px]:w-4 max-[768px]:h-4 max-[425px]:w-3.5 max-[425px]:h-3.5 max-[375px]:w-3 max-[375px]:h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M2 10l7-7 1.414 1.414L5.828 9H18v2H5.828l4.586 4.586L9 17l-7-7z" transform="rotate(180 10 10)"/>
                                            </svg>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 max-[768px]:bottom-4 max-[768px]:right-4 max-[425px]:bottom-3 max-[425px]:right-3 max-[375px]:bottom-2 max-[375px]:right-2 max-[320px]:bottom-1.5 max-[320px]:right-1.5 w-20 h-20 max-[768px]:w-16 max-[768px]:h-16 max-[425px]:w-14 max-[425px]:h-14 max-[375px]:w-14 max-[375px]:h-14 max-[320px]:w-14 max-[320px]:h-14 bg-[#058743] hover:bg-[#046635] rounded-full shadow-lg flex items-center justify-center transition-all duration-200 z-50 group"
                >
                    <img 
                        src="/images/icons/ai_chatbot_logo.svg" 
                        alt="AI Chatbot" 
                        className="w-10 h-10 max-[768px]:w-8 max-[768px]:h-8 max-[425px]:w-7 max-[425px]:h-7 max-[375px]:w-7 max-[375px]:h-7 max-[320px]:w-7 max-[320px]:h-7"
                    />
                </button>
            )}
        </>
    );
}