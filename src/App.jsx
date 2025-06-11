import React, { useState, useEffect, useRef } from 'react';

// Main App component
const App = () => {
    // State variables
    const [tyreImage, setTyreImage] = useState(null); // Stores the uploaded tyre image
    const [healthScore, setHealthScore] = useState(null); // Stores the simulated health score
    const [recommendation, setRecommendation] = useState(''); // Stores the simulated recommendation
    const [analysisDetails, setAnalysisDetails] = useState(''); // Stores detailed analysis from AI
    const [userLocation, setUserLocation] = useState(null); // Stores user's geographic coordinates
    const [loading, setLoading] = useState(false); // Indicates loading state for AI processing or geolocation
    const [errorMessage, setErrorMessage] = useState(''); // Stores any error messages
    const [currentStep, setCurrentStep] = useState(1); // Controls the current step of the process (1: Welcome, 2: Scan, 3: Results, 4: Location)
    // Removed permissionStatus state as permission is now requested on click

    const videoRef = useRef(null); // Reference to the video element for camera stream
    const canvasRef = useRef(null); // Reference to the canvas element for capturing images

    // Removed the useEffect that queried geolocation permissions on component mount.
    // Permission will now be requested directly when 'Get My Location' button is clicked.

    // Function to handle image upload/selection
    const handleImageChange = (event) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setTyreImage(reader.result); // Set the image data
                setHealthScore(null); // Reset score
                setRecommendation(''); // Reset recommendation
                setAnalysisDetails(''); // Reset analysis details
                setErrorMessage(''); // Clear previous errors
                // Automatically close camera if an image is uploaded
                if (videoRef.current && videoRef.current.srcObject) {
                    const tracks = videoRef.current.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                    videoRef.current.srcObject = null;
                }
            };
            reader.readAsDataURL(file); // Read file as data URL
        }
    };

    // Function to start the camera stream
    const startCamera = async () => {
        setErrorMessage('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (error) {
            console.error("Error accessing camera: ", error);
            setErrorMessage("Could not access camera. Please ensure permissions are granted in your browser settings.");
        }
    };

    // Function to capture photo from camera stream
    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            const imageData = canvasRef.current.toDataURL('image/png');
            setTyreImage(imageData);
            setHealthScore(null);
            setRecommendation('');
            setAnalysisDetails('');
            setErrorMessage('');

            // Stop the camera stream after capturing
            if (videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }
        }
    };

    // Function to simulate AI detection using the Gemini API
    const detectTyreHealth = async () => {
        if (!tyreImage) {
            setErrorMessage("Please upload or capture an image of the tyre first.");
            return;
        }

        setLoading(true);
        setErrorMessage('');
        try {
            // Extract base64 data from the data URL
            const base64ImageData = tyreImage.split(',')[1];
            // Updated prompt to guide the AI for a more detailed and 'accurate' analysis
            const prompt = `First Check if the given image is of tyre or something else. if not tyre image than show meesage upload correct image of tyre. Analyze the provided tyre image for signs of wear, tread depth, and general condition.
                           Based on this simulated analysis, generate a random health score between 1 and 10 (integer).
                           Provide a brief, specific analysis detailing *why* that score was given. This analysis should use simple English and be easy to understand by a general user. For example, instead of "Good tread depth observed," say "The grooves on your tire look deep and healthy." Instead of "Minor sidewall cracking detected," say "There are a few small cracks on the side of your tire." Instead of "Uneven wear indicates alignment issue," say "The tire is wearing down more on one side, which might mean your wheel alignment needs checking."
                           Finally, generate a recommendation based on the score:
                           - If the score is 7-10, recommend: "Your tyre health is good! Keep up with regular maintenance."
                           - If the score is 4-6, recommend: "Your tyre health condition is moderate. We suggest checking tyre pressure and rotation soon."
                           - If the score is 1-3, explicitly state: "Your tyre health condition is not good. We suggest you to visit a nearby CEAT outlet and get proper guidance and inspection immediately."
                           Provide the output in JSON format with 'score' (number), 'recommendation' (string), and 'analysisDetails' (string) fields.`;


            const chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: "image/png", // Assuming PNG, but could be dynamic based on file type
                                    data: base64ImageData
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            "score": { "type": "INTEGER" },
                            "recommendation": { "type": "STRING" },
                            "analysisDetails": { "type": "STRING" } // New field for detailed analysis
                        },
                        "propertyOrdering": ["score", "recommendation", "analysisDetails"]
                    }
                }
            };

            const apiKey = "AIzaSyBK_nu09OEm3TCgwXssCSMGGVyIPk4FND4"; 
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }

            const result = await response.json();
            console.log("Gemini API Response:", result);

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const jsonText = result.candidates[0].content.parts[0].text;
                const parsedJson = JSON.parse(jsonText);
                setHealthScore(parsedJson.score);
                setRecommendation(parsedJson.recommendation);
                setAnalysisDetails(parsedJson.analysisDetails); // Set the new analysis details
                setCurrentStep(3); // Move to results page after detection
            } else {
                setErrorMessage("AI detection failed: Unexpected response structure.");
            }
        } catch (error) {
            console.error("Error detecting tyre health:", error);
            setErrorMessage(`Error processing image: ${error.message}. Please try again.`);
        } finally {
            setLoading(false);
        }
    };

    // Function to get user's current location - now triggers permission prompt if needed
    const getGeolocation = () => {
        setLoading(true);
        setErrorMessage('');
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                    setLoading(false);
                },
                (error) => {
                    console.error("Error getting geolocation: ", error);
                    let geoErrorMessage = 'An unknown error occurred.';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            geoErrorMessage = "You denied location access. Please enable it in browser settings to use this feature.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            geoErrorMessage = "Location information is unavailable. Please check your device's location settings.";
                            break;
                        case error.TIMEOUT:
                            geoErrorMessage = "The request to get your location timed out. Please try again.";
                            break;
                        default:
                            geoErrorMessage = `Geolocation error: ${error.message || 'Unknown error'}.`;
                            break;
                    }
                    setErrorMessage(geoErrorMessage);
                    setLoading(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            setErrorMessage("Geolocation is not supported by your browser.");
            setLoading(false);
        }
    };

    // Function to reset the application to the initial state
    const resetApp = () => {
        setTyreImage(null);
        setHealthScore(null);
        setRecommendation('');
        setAnalysisDetails('');
        setUserLocation(null);
        setLoading(false);
        setErrorMessage('');
        setCurrentStep(1);
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans flex items-center justify-center">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-sm sm:max-w-md md:max-w-2xl w-full border border-blue-100 mx-auto">
                {/* Replaced H1 with CEAT Logo Image */}
                <img
                    src="https://www.ceat.com/content/dam/ceat/website/logo.png"
                    alt="CEAT Tyres Logo"
                    className="max-w-[150px] sm:max-w-[200px] md:max-w-[250px] mx-auto block mb-6 sm:mb-8"
                    onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/250x100/A0A0A0/FFFFFF?text=CEAT+Logo"; }}
                />

                {/* --- Step 1: Welcome Banner --- */}
                {currentStep === 1 && (
                    <div className="text-center">
                        <div className="bg-blue-100 text-blue-900 p-5 sm:p-6 rounded-lg mb-6 sm:mb-8 shadow-lg transform hover:scale-105 transition-transform duration-300">
                            <p className="text-xl sm:text-2xl font-semibold mb-2">
                                Welcome to CEAT Tyre Health!
                            </p>
                            <p className="text-base sm:text-xl">
                                Get started by checking your tyre's health in a few simple steps.
                            </p>
                        </div>
                        <button
                            onClick={() => setCurrentStep(2)}
                            className="w-full py-3 px-6 rounded-lg font-bold text-lg shadow-lg bg-blue-600 hover:bg-blue-700 transform hover:scale-105 transition-all duration-300 text-white"
                        >
                            Start Tyre Health Check
                        </button>
                    </div>
                )}

                {/* --- Step 2: Image Upload/Camera Scan --- */}
                {currentStep === 2 && (
                    <div className="mb-6 sm:mb-8 p-5 sm:p-6 bg-white rounded-lg shadow-inner border border-blue-200">
                        <h2 className="text-xl sm:text-2xl font-bold text-blue-800 mb-4 text-center">Step 1: Scan Your Tyre</h2>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4">
                            <label htmlFor="tyre-upload" className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg shadow-md transition-all duration-300 transform hover:-translate-y-1 text-sm sm:text-base w-full sm:w-auto text-center">
                                Upload Tyre Image
                                <input
                                    id="tyre-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                            </label>
                            <button
                                onClick={startCamera}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg shadow-md transition-all duration-300 transform hover:-translate-y-1 text-sm sm:text-base w-full sm:w-auto"
                            >
                                Open Camera
                            </button>
                        </div>

                        {/* Camera stream display */}
                        <div className="flex justify-center mb-4">
                            <video ref={videoRef} className="w-full max-w-xs sm:max-w-sm rounded-lg border border-gray-400 bg-gray-100" style={{ display: tyreImage || !videoRef.current?.srcObject ? 'none' : 'block' }} autoPlay playsInline></video>
                            <canvas ref={canvasRef} className="hidden"></canvas> {/* Hidden canvas for photo capture */}
                        </div>
                        {videoRef.current?.srcObject && (
                            <div className="flex justify-center mb-4">
                                <button
                                    onClick={capturePhoto}
                                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg shadow-md transition-all duration-300 transform hover:-translate-y-1 text-sm sm:text-base w-full sm:w-auto"
                                >
                                    Capture Photo
                                </button>
                            </div>
                        )}


                        {tyreImage && (
                            <div className="mt-4 flex justify-center">
                                <img src={tyreImage} alt="Tyre Preview" className="max-w-full h-auto rounded-lg shadow-lg border border-blue-200 object-cover w-48 h-48 sm:w-64 sm:h-64" />
                            </div>
                        )}

                        <div className="mt-6 text-center">
                            <button
                                onClick={detectTyreHealth}
                                disabled={loading || !tyreImage}
                                className={`w-full py-3 px-6 rounded-lg font-bold text-base sm:text-lg shadow-lg transition-all duration-300 ${
                                    loading || !tyreImage
                                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105 text-white'
                                }`}
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Detecting Health...
                                    </div>
                                ) : (
                                    'Analyze Tyre Health'
                                )}
                            </button>
                        </div>
                        <button
                            onClick={resetApp}
                            className="mt-4 w-full py-2 px-4 rounded-lg font-bold text-sm sm:text-md shadow-md bg-gray-200 hover:bg-gray-300 text-gray-800 transition-all duration-300"
                        >
                            Start Over
                        </button>
                    </div>
                )}

                {/* --- Step 3: Tyre Health Results --- */}
                {currentStep === 3 && healthScore !== null && (
                    <div className="mb-6 sm:mb-8 p-5 sm:p-6 bg-white rounded-lg shadow-inner border border-blue-200 text-center">
                        <h2 className="text-xl sm:text-2xl font-bold text-blue-800 mb-4">Step 2: Tyre Health Report</h2>
                        <div className="text-2xl sm:text-3xl font-extrabold mb-4">
                            Health Score: <span className={healthScore >= 7 ? 'text-green-600' : healthScore >= 4 ? 'text-orange-600' : 'text-red-600'}>{healthScore}/10</span>
                        </div>
                        {analysisDetails && (
                            <p className="text-sm sm:text-md text-gray-700 leading-relaxed mt-2 mb-4">
                                <span className="font-semibold">Detailed Analysis:</span> {analysisDetails}
                            </p>
                        )}
                        <p className="text-base sm:text-lg text-gray-800 leading-relaxed">
                            <span className="font-semibold">Recommendation:</span> {recommendation}
                        </p>
                        <button
                            onClick={() => setCurrentStep(4)}
                            className="mt-6 w-full py-3 px-6 rounded-lg font-bold text-base sm:text-lg shadow-lg bg-blue-600 hover:bg-blue-700 transform hover:scale-105 transition-all duration-300 text-white"
                        >
                            Find Nearest CEAT Outlet
                        </button>
                        <button
                            onClick={resetApp}
                            className="mt-4 w-full py-2 px-4 rounded-lg font-bold text-sm sm:text-md shadow-md bg-gray-200 hover:bg-gray-300 text-gray-800 transition-all duration-300"
                        >
                            Start Over
                        </button>
                    </div>
                )}

                {/* --- Step 4: Geolocation and Dealership Recommendation --- */}
                {currentStep === 4 && (
                    <div className="p-5 sm:p-6 bg-white rounded-lg shadow-inner border border-blue-200 text-center">
                        <h2 className="text-xl sm:text-2xl font-bold text-blue-800 mb-4">Step 3: Find Nearest CEAT Outlet</h2>
                        {!userLocation ? (
                            // Removed conditional messages based on permissionStatus.
                            // The browser's native prompt will handle initial request.
                            <button
                                onClick={getGeolocation} // This call will trigger the permission prompt
                                disabled={loading}
                                className={`w-full py-3 px-6 rounded-lg font-bold text-base sm:text-lg shadow-lg transition-all duration-300 ${
                                    loading
                                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                        : 'bg-orange-600 hover:bg-orange-700 transform hover:scale-105 text-white'
                                }`}
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Getting Location...
                                    </div>
                                ) : (
                                    'Get My Location'
                                )}
                            </button>
                        ) : (
                            <div className="mt-4 text-gray-800">
                                <p className="text-base sm:text-lg">Your Current Location:</p>
                                <p className="font-semibold text-sm sm:text-base">Latitude: {userLocation.latitude.toFixed(4)}</p>
                                <p className="font-semibold text-sm sm:text-base">Longitude: {userLocation.longitude.toFixed(4)}</p>
                                <p className="mt-4 text-blue-700 text-lg sm:text-xl font-bold">
                                    Please visit your nearest CEAT outlet for expert assistance!
                                </p>
                                <p className="text-xs sm:text-sm text-gray-600 mt-2">
                                    (In a real application, this would show actual nearby dealerships based on your location.)
                                </p>
                            </div>
                        )}
                        <button
                            onClick={resetApp}
                            className="mt-6 w-full py-2 px-4 rounded-lg font-bold text-sm sm:text-md shadow-md bg-gray-200 hover:bg-gray-300 text-gray-800 transition-all duration-300"
                        >
                            Start Over
                        </button>
                    </div>
                )}

                {errorMessage && (
                    <div className="mt-8 p-4 bg-red-800 text-white rounded-lg shadow-lg text-center font-medium text-sm sm:text-base">
                        {errorMessage}
                    </div>
                )}

                <footer className="mt-12 text-center text-gray-600 text-xs sm:text-sm">
                    &copy; {new Date().getFullYear()} CEAT Tyres. All rights reserved.
                </footer>
            </div>
        </div>
    );
};

export default App;