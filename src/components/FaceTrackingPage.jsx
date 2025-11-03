import React, { useRef, useEffect, useState } from 'react';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { useDarkMode } from '../utils/useDarkMode';

const FaceTrackingPage = ({ onBack }) => {
  const { isDarkMode } = useDarkMode();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [emotion, setEmotion] = useState('Neutral');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState(null);
  const [additionalFeatures, setAdditionalFeatures] = useState({
    eyeAspectRatio: 0,
    mouthAspectRatio: 0,
    headPose: { pitch: 0, yaw: 0, roll: 0 }
  });
  const [attention, setAttention] = useState({
    isLookingAtCamera: false,
    attentionScore: 0,
    gazeDirection: 'Center'
  });
  const animationFrameRef = useRef(null);

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    const initializeFaceLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1
        });
        
        setFaceLandmarker(landmarker);
      } catch (err) {
        console.error('Error initializing Face Landmarker:', err);
        setError('Failed to initialize face tracking. Please refresh the page.');
      }
    };

    initializeFaceLandmarker();

    return () => {
      if (faceLandmarker) {
        faceLandmarker.close();
      }
    };
  }, []);

  // Calculate Eye Aspect Ratio (EAR) for blink detection
  const calculateEAR = (landmarks, eyeIndices) => {
    const vertical1 = Math.sqrt(
      Math.pow(landmarks[eyeIndices[1]].x - landmarks[eyeIndices[5]].x, 2) +
      Math.pow(landmarks[eyeIndices[1]].y - landmarks[eyeIndices[5]].y, 2)
    );
    const vertical2 = Math.sqrt(
      Math.pow(landmarks[eyeIndices[2]].x - landmarks[eyeIndices[4]].x, 2) +
      Math.pow(landmarks[eyeIndices[2]].y - landmarks[eyeIndices[4]].y, 2)
    );
    const horizontal = Math.sqrt(
      Math.pow(landmarks[eyeIndices[0]].x - landmarks[eyeIndices[3]].x, 2) +
      Math.pow(landmarks[eyeIndices[0]].y - landmarks[eyeIndices[3]].y, 2)
    );
    
    return (vertical1 + vertical2) / (2.0 * horizontal);
  };

  // Calculate Mouth Aspect Ratio (MAR) for smile/mouth open detection
  const calculateMAR = (landmarks) => {
    const vertical = Math.sqrt(
      Math.pow(landmarks[13].x - landmarks[14].x, 2) +
      Math.pow(landmarks[13].y - landmarks[14].y, 2)
    );
    const horizontal = Math.sqrt(
      Math.pow(landmarks[78].x - landmarks[308].x, 2) +
      Math.pow(landmarks[78].y - landmarks[308].y, 2)
    );
    
    return vertical / horizontal;
  };

  // Calculate head pose and gaze direction for attention tracking
  const calculateAttention = (landmarks) => {
    // Get key facial points
    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    // Calculate face center
    const faceCenterX = (leftEye.x + rightEye.x) / 2;

    // Calculate yaw (left-right head rotation)
    // If looking straight: nose should be centered between eyes
    const eyeDistance = Math.abs(rightEye.x - leftEye.x);
    const noseOffset = noseTip.x - faceCenterX;
    const yaw = (noseOffset / eyeDistance) * 90; // Convert to approximate degrees

    // Calculate pitch (up-down head tilt)
    // If looking straight: nose-forehead and nose-chin distances should be balanced
    const foreheadDist = Math.abs(noseTip.y - forehead.y);
    const chinDist = Math.abs(chin.y - noseTip.y);
    const pitch = ((foreheadDist - chinDist) / (foreheadDist + chinDist)) * 90;

    // Determine gaze direction - more lenient thresholds
    let gazeDirection = 'Center';
    if (Math.abs(yaw) > 25) { // Increased from 15 to 25
      gazeDirection = yaw > 0 ? 'Left' : 'Right';
    } else if (Math.abs(pitch) > 25) { // Increased from 15 to 25
      gazeDirection = pitch > 0 ? 'Down' : 'Up';
    }

    // Calculate attention score (0-100) - more forgiving
    // Higher score when looking at camera (center gaze, minimal head rotation)
    const yawPenalty = Math.min(Math.abs(yaw) / 45, 1); // Increased from 30 to 45 degrees
    const pitchPenalty = Math.min(Math.abs(pitch) / 45, 1); // Increased from 30 to 45 degrees
    const attentionScore = Math.max(0, 100 - (yawPenalty * 50 + pitchPenalty * 50));

    // Consider "looking at camera" if attention score > 60 (lowered from 70)
    const isLookingAtCamera = attentionScore > 60;

    return {
      isLookingAtCamera,
      attentionScore,
      gazeDirection,
      yaw: yaw.toFixed(1),
      pitch: pitch.toFixed(1)
    };
  };

  // Detect emotion based on facial landmarks and blendshapes
  const detectEmotion = (landmarks, blendshapes) => {
    if (!blendshapes || blendshapes.length === 0) {
      return { emotion: 'Neutral', confidence: 0 };
    }

    // Get blendshape values
    const getBlendshapeValue = (name) => {
      const shape = blendshapes.find(b => b.categoryName === name);
      return shape ? shape.score : 0;
    };

    // Get all relevant blendshapes
    const smileLeft = getBlendshapeValue('mouthSmileLeft');
    const smileRight = getBlendshapeValue('mouthSmileRight');
    const mouthFrownLeft = getBlendshapeValue('mouthFrownLeft');
    const mouthFrownRight = getBlendshapeValue('mouthFrownRight');
    const eyeWideLeft = getBlendshapeValue('eyeWideLeft');
    const eyeWideRight = getBlendshapeValue('eyeWideRight');
    const eyeSquintLeft = getBlendshapeValue('eyeSquintLeft');
    const eyeSquintRight = getBlendshapeValue('eyeSquintRight');
    const browDownLeft = getBlendshapeValue('browDownLeft');
    const browDownRight = getBlendshapeValue('browDownRight');
    const browInnerUp = getBlendshapeValue('browInnerUp');
    const browOuterUpLeft = getBlendshapeValue('browOuterUpLeft');
    const browOuterUpRight = getBlendshapeValue('browOuterUpRight');
    const jawOpen = getBlendshapeValue('jawOpen');
    const mouthPucker = getBlendshapeValue('mouthPucker');
    const cheekSquintLeft = getBlendshapeValue('cheekSquintLeft');
    const cheekSquintRight = getBlendshapeValue('cheekSquintRight');

    // Calculate eye and mouth aspect ratios
    const leftEyeIndices = [33, 160, 158, 133, 153, 144];
    const rightEyeIndices = [362, 385, 387, 263, 373, 380];
    const leftEAR = calculateEAR(landmarks, leftEyeIndices);
    const rightEAR = calculateEAR(landmarks, rightEyeIndices);
    const avgEAR = (leftEAR + rightEAR) / 2;
    const mar = calculateMAR(landmarks);

    // Calculate attention
    const attentionData = calculateAttention(landmarks);
    setAttention(attentionData);

    setAdditionalFeatures({
      eyeAspectRatio: avgEAR.toFixed(3),
      mouthAspectRatio: mar.toFixed(3),
      headPose: { 
        pitch: attentionData.pitch, 
        yaw: attentionData.yaw, 
        roll: 0 
      }
    });

    // Enhanced emotion detection with better thresholds and combinations
    const avgSmile = (smileLeft + smileRight) / 2;
    const avgFrown = (mouthFrownLeft + mouthFrownRight) / 2;
    const avgEyeWide = (eyeWideLeft + eyeWideRight) / 2;
    const avgEyeSquint = (eyeSquintLeft + eyeSquintRight) / 2;
    const avgBrowDown = (browDownLeft + browDownRight) / 2;
    const avgBrowOuterUp = (browOuterUpLeft + browOuterUpRight) / 2;
    const avgCheekSquint = (cheekSquintLeft + cheekSquintRight) / 2;

    // Calculate emotion scores with improved logic
    const emotions = {
      'Happy': Math.min(1, (
        avgSmile * 1.5 + 
        avgCheekSquint * 0.8 + 
        (mar > 0.3 ? 0.3 : 0) // Slight mouth opening
      )),
      
      'Sad': Math.min(1, (
        avgFrown * 1.8 + // Increased weight for frown
        browInnerUp * 1.2 + // Increased weight for inner brow up (sad eyebrows)
        (avgEAR < 0.18 ? 0.5 : 0) + // Stronger penalty for droopy eyes
        (avgSmile < 0.1 ? 0.3 : -avgSmile * 0.5) + // Bonus for no smile, penalty if smiling
        (mouthPucker * 0.4) // Slight mouth compression
      )),
      
      'Surprised': Math.min(1, (
        avgEyeWide * 1.8 + // Increased weight - need really wide eyes
        browInnerUp * 0.5 + // Reduced from 0.7
        avgBrowOuterUp * 0.5 + // Reduced from 0.7
        jawOpen * 0.8 + // Increased weight - mouth should be open
        (avgEAR > 0.28 ? 0.4 : 0) + // Increased threshold from 0.25 to 0.28, eyes must be very wide
        (jawOpen > 0.3 ? 0.3 : -0.2) // Bonus for open mouth, penalty if closed
      )),
      
      'Angry': Math.min(1, (
        avgBrowDown * 1.4 + 
        avgEyeSquint * 0.9 + 
        mouthPucker * 0.4 +
        (avgFrown * 0.3)
      )),
      
      'Neutral': 0 // Will be calculated based on other emotions
    };

    // Calculate neutral as inverse of other emotions
    const maxOtherEmotion = Math.max(
      emotions.Happy,
      emotions.Sad,
      emotions.Surprised,
      emotions.Angry
    );
    
    // Neutral is high when other emotions are low
    emotions.Neutral = Math.max(0, 1 - maxOtherEmotion * 1.5);

    // Apply minimum threshold to filter noise - higher threshold for surprised
    const threshold = 0.12; // Reduced from 0.15
    const surprisedThreshold = 0.25; // Much higher threshold for surprised
    Object.keys(emotions).forEach(key => {
      const minThreshold = key === 'Surprised' ? surprisedThreshold : threshold;
      if (emotions[key] < minThreshold && key !== 'Neutral') {
        emotions[key] = 0;
      }
    });

    // Find the emotion with highest confidence
    let maxEmotion = 'Neutral';
    let maxConfidence = emotions.Neutral;

    for (const [emotion, score] of Object.entries(emotions)) {
      if (score > maxConfidence) {
        maxConfidence = score;
        maxEmotion = emotion;
      }
    }

    // Scale confidence to 0-100 range
    const scaledConfidence = Math.min(maxConfidence * 100, 100);

    return {
      emotion: maxEmotion,
      confidence: scaledConfidence
    };
  };

  // Start webcam
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video metadata to load before starting processing
        const onLoadedMetadata = () => {
          // Ensure video has started playing
          videoRef.current.play().then(() => {
            setIsRunning(true);
            // Small delay to ensure video is really ready
            setTimeout(() => {
              processFrame();
            }, 100);
          }).catch(err => {
            console.error('Error playing video:', err);
            setError('Failed to start video playback.');
          });
        };

        if (videoRef.current.readyState >= 2) {
          // Metadata already loaded
          onLoadedMetadata();
        } else {
          // Wait for metadata to load
          videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Failed to access camera. Please ensure you have granted camera permissions.');
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setIsRunning(false);
  };

  // Process each video frame
  const processFrame = () => {
    if (!faceLandmarker || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Check if video has valid dimensions before processing
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      // Detect face landmarks
      const startTimeMs = performance.now();
      const results = faceLandmarker.detectForVideo(video, startTimeMs);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const blendshapes = results.faceBlendshapes && results.faceBlendshapes.length > 0 
          ? results.faceBlendshapes[0].categories 
          : [];

        // Draw landmarks
        const drawingUtils = new DrawingUtils(ctx);
        
        // Draw face mesh
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_TESSELATION,
          { color: '#C0C0C070', lineWidth: 1 }
        );
        
        // Draw facial contours
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
          { color: '#FF3030' }
        );
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
          { color: '#FF3030' }
        );
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
          { color: '#30FF30' }
        );
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
          { color: '#30FF30' }
        );
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
          { color: '#E0E0E0' }
        );
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_LIPS,
          { color: '#E0E0E0' }
        );

        // Detect emotion
        const { emotion: detectedEmotion, confidence: emotionConfidence } = detectEmotion(landmarks, blendshapes);
        setEmotion(detectedEmotion);
        setConfidence(emotionConfidence);
      }
    } catch (err) {
      console.error('Error processing frame:', err);
      // Don't stop the loop, just skip this frame
    }

    // Continue processing
    animationFrameRef.current = requestAnimationFrame(processFrame);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (faceLandmarker) {
        faceLandmarker.close();
      }
    };
  }, [faceLandmarker]);

  return (
    <div className={`min-h-screen transition-colors duration-500 ${
      isDarkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    }`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className={`text-4xl font-bold transition-colors duration-500 ${
            isDarkMode ? 'text-sky-blue' : 'text-sky-600'
          }`}>
            Face Tracking Demo
          </h1>
          <button
            onClick={onBack}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
              isDarkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Back to Profile
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg ${
            isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'
          }`}>
            {error}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2">
            <div className={`rounded-xl shadow-2xl overflow-hidden ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="hidden"
                />
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                  style={{ maxHeight: '600px' }}
                />
                
                {!isRunning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <p className="text-white text-xl">Camera not started</p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="p-6">
                <div className="flex gap-4 justify-center">
                  {!isRunning ? (
                    <button
                      onClick={startCamera}
                      disabled={!faceLandmarker}
                      className={`px-8 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                        isDarkMode
                          ? 'bg-sky-blue text-black hover:bg-sky-400 shadow-sky-blue/50 disabled:bg-gray-700 disabled:text-gray-500'
                          : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/30 disabled:bg-gray-300 disabled:text-gray-500'
                      } disabled:cursor-not-allowed disabled:transform-none`}
                    >
                      {!faceLandmarker ? 'Loading...' : 'Start Camera'}
                    </button>
                  ) : (
                    <button
                      onClick={stopCamera}
                      className={`px-8 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                        isDarkMode
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-red-500 text-white hover:bg-red-600'
                      }`}
                    >
                      Stop Camera
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            {/* Attention/Eye Contact Display */}
            <div className={`rounded-xl shadow-xl p-6 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h2 className={`text-2xl font-bold mb-4 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                👁️ Attention Tracking
              </h2>
              
              <div className="text-center mb-4">
                <div className={`text-4xl mb-2`}>
                  {attention.isLookingAtCamera ? '✅' : '❌'}
                </div>
                <div className={`text-xl font-bold ${
                  attention.isLookingAtCamera
                    ? (isDarkMode ? 'text-green-400' : 'text-green-600')
                    : (isDarkMode ? 'text-red-400' : 'text-red-600')
                }`}>
                  {attention.isLookingAtCamera ? 'Looking at Camera' : 'Not Looking'}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Attention Score
                  </span>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                    {attention.attentionScore.toFixed(0)}%
                  </span>
                </div>
                <div className={`w-full h-4 rounded-full overflow-hidden ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <div
                    className={`h-full transition-all duration-300 ${
                      attention.attentionScore > 60 // Changed from 70
                        ? 'bg-gradient-to-r from-green-500 to-green-600'
                        : attention.attentionScore > 30 // Changed from 40
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                        : 'bg-gradient-to-r from-red-500 to-red-600'
                    }`}
                    style={{ width: `${attention.attentionScore}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Gaze Direction
                  </span>
                  <span className={`font-mono font-bold ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`}>
                    {attention.gazeDirection}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Head Yaw (L/R)
                  </span>
                  <span className={`font-mono ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`}>
                    {attention.yaw}°
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Head Pitch (U/D)
                  </span>
                  <span className={`font-mono ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`}>
                    {attention.pitch}°
                  </span>
                </div>
              </div>
            </div>

            {/* Emotion Display */}
            <div className={`rounded-xl shadow-xl p-6 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h2 className={`text-2xl font-bold mb-4 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                Detected Emotion
              </h2>
              
              <div className="text-center mb-4">
                <div className={`text-5xl mb-2`}>
                  {emotion === 'Happy' && '😊'}
                  {emotion === 'Sad' && '😢'}
                  {emotion === 'Surprised' && '😲'}
                  {emotion === 'Angry' && '😠'}
                  {emotion === 'Neutral' && '😐'}
                </div>
                <div className={`text-3xl font-bold ${
                  isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                }`}>
                  {emotion}
                </div>
              </div>

              <div className="mb-2">
                <div className="flex justify-between mb-1">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Confidence
                  </span>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                    {confidence.toFixed(1)}%
                  </span>
                </div>
                <div className={`w-full h-4 rounded-full overflow-hidden ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-300"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Additional Features */}
            <div className={`rounded-xl shadow-xl p-6 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h2 className={`text-2xl font-bold mb-4 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                Face Metrics
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Eye Aspect Ratio
                  </span>
                  <span className={`font-mono ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`}>
                    {additionalFeatures.eyeAspectRatio}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Mouth Aspect Ratio
                  </span>
                  <span className={`font-mono ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`}>
                    {additionalFeatures.mouthAspectRatio}
                  </span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className={`rounded-xl shadow-xl p-6 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h2 className={`text-xl font-bold mb-3 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                About
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                This demo uses MediaPipe Face Landmarker to detect facial landmarks and 
                estimate emotions in real-time. The attention tracker analyzes head pose 
                and gaze direction to determine if you're looking at the camera.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceTrackingPage;
