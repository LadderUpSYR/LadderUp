import { useState, useRef, useCallback, useEffect } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Custom hook for video capture with face tracking in match rooms
 * Adapted from usePracticeVideoCapture for multiplayer context
 * 
 * Key differences from practice mode:
 * - Sends facial tracking data through WebSocket to opponent
 * - Receives and displays opponent's facial tracking data
 * - Optimized for dual-user scenarios
 */
export function useMatchVideoCapture(wsRef) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  
  // Real-time tracking state for current player
  const [currentAttention, setCurrentAttention] = useState({
    isLookingAtCamera: false,
    attentionScore: 0,
    gazeDirection: 'Center'
  });
  const [currentEmotion, setCurrentEmotion] = useState({
    emotion: 'Neutral',
    confidence: 0
  });
  
  // Opponent's facial tracking data (received via WebSocket)
  const [opponentAttention, setOpponentAttention] = useState({
    isLookingAtCamera: false,
    attentionScore: 0,
    gazeDirection: 'Center'
  });
  const [opponentEmotion, setOpponentEmotion] = useState({
    emotion: 'Neutral',
    confidence: 0
  });
  
  // Refs for video processing
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  
  // Tracking data accumulation
  const attentionScoresRef = useRef([]);
  const emotionDataRef = useRef([]);
  const trackingStartTimeRef = useRef(null);
  const isTrackingRef = useRef(false);
  
  // WebSocket data sending interval
  const sendIntervalRef = useRef(null);
  const lastSentDataRef = useRef(null);

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
        
        faceLandmarkerRef.current = landmarker;
        setFaceLandmarker(landmarker);
        console.log('Face Landmarker initialized for match mode');
      } catch (err) {
        console.error('Error initializing Face Landmarker:', err);
        setVideoError('Failed to initialize face tracking. Please refresh the page.');
      }
    };

    initializeFaceLandmarker();

    return () => {
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
    };
  }, []);

  /**
   * Send facial tracking data through WebSocket
   */
  const sendFacialData = useCallback((attentionData, emotionData) => {
    if (wsRef?.current && wsRef.current.readyState === WebSocket.OPEN) {
      const data = {
        type: 'facial_tracking',
        attention: {
          isLookingAtCamera: attentionData.isLookingAtCamera,
          attentionScore: attentionData.attentionScore,
          gazeDirection: attentionData.gazeDirection
        },
        emotion: {
          emotion: emotionData.emotion,
          confidence: emotionData.confidence
        },
        timestamp: Date.now()
      };
      
      // Only send if data has changed significantly
      const shouldSend = !lastSentDataRef.current ||
        Math.abs(lastSentDataRef.current.attention.attentionScore - attentionData.attentionScore) > 5 ||
        lastSentDataRef.current.emotion.emotion !== emotionData.emotion ||
        lastSentDataRef.current.attention.isLookingAtCamera !== attentionData.isLookingAtCamera;
      
      if (shouldSend) {
        wsRef.current.send(JSON.stringify(data));
        lastSentDataRef.current = data;
      }
    }
  }, [wsRef]);

  /**
   * Handle incoming facial tracking data from opponent
   */
  const handleOpponentFacialData = useCallback((data) => {
    if (data.attention) {
      setOpponentAttention(data.attention);
    }
    if (data.emotion) {
      setOpponentEmotion(data.emotion);
    }
  }, []);

  /**
   * Calculate Eye Aspect Ratio (EAR) for blink detection
   */
  const calculateEAR = useCallback((landmarks, eyeIndices) => {
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
  }, []);

  /**
   * Calculate Mouth Aspect Ratio (MAR)
   */
  const calculateMAR = useCallback((landmarks) => {
    const vertical = Math.sqrt(
      Math.pow(landmarks[13].x - landmarks[14].x, 2) +
      Math.pow(landmarks[13].y - landmarks[14].y, 2)
    );
    const horizontal = Math.sqrt(
      Math.pow(landmarks[78].x - landmarks[308].x, 2) +
      Math.pow(landmarks[78].y - landmarks[308].y, 2)
    );
    
    return vertical / horizontal;
  }, []);

  /**
   * Calculate eye gaze direction by analyzing iris position
   */
  const calculateEyeGaze = useCallback((landmarks) => {
    // Left eye landmarks
    const leftEyeCenter = landmarks[468];
    const leftEyeLeft = landmarks[33];
    const leftEyeRight = landmarks[133];
    const leftEyeTop = landmarks[159];
    const leftEyeBottom = landmarks[145];
    
    // Right eye landmarks
    const rightEyeCenter = landmarks[473];
    const rightEyeLeft = landmarks[362];
    const rightEyeRight = landmarks[263];
    const rightEyeTop = landmarks[386];
    const rightEyeBottom = landmarks[374];
    
    // Calculate left eye gaze
    const leftEyeWidth = Math.abs(leftEyeRight.x - leftEyeLeft.x);
    const leftEyeHeight = Math.abs(leftEyeBottom.y - leftEyeTop.y);
    const leftHorizontalRatio = (leftEyeCenter.x - leftEyeLeft.x) / leftEyeWidth;
    const leftVerticalRatio = (leftEyeCenter.y - leftEyeTop.y) / leftEyeHeight;
    
    // Calculate right eye gaze
    const rightEyeWidth = Math.abs(rightEyeRight.x - rightEyeLeft.x);
    const rightEyeHeight = Math.abs(rightEyeBottom.y - rightEyeTop.y);
    const rightHorizontalRatio = (rightEyeCenter.x - rightEyeLeft.x) / rightEyeWidth;
    const rightVerticalRatio = (rightEyeCenter.y - rightEyeTop.y) / rightEyeHeight;
    
    // Average both eyes
    const avgHorizontalRatio = (leftHorizontalRatio + rightHorizontalRatio) / 2;
    const avgVerticalRatio = (leftVerticalRatio + rightVerticalRatio) / 2;
    
    const horizontalGaze = (avgHorizontalRatio - 0.5) * 80;
    const verticalGaze = (avgVerticalRatio - 0.5) * 60;
    
    return { horizontalGaze, verticalGaze };
  }, []);

  /**
   * Calculate attention metrics from facial landmarks and eye gaze
   */
  const calculateAttention = useCallback((landmarks) => {
    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    const faceCenterX = (leftEye.x + rightEye.x) / 2;

    const eyeDistance = Math.abs(rightEye.x - leftEye.x);
    const noseOffset = noseTip.x - faceCenterX;
    const yaw = (noseOffset / eyeDistance) * 90;

    const foreheadDist = Math.abs(noseTip.y - forehead.y);
    const chinDist = Math.abs(chin.y - noseTip.y);
    const pitch = ((foreheadDist - chinDist) / (foreheadDist + chinDist)) * 90;

    const eyeGaze = calculateEyeGaze(landmarks);
    
    const totalHorizontalGaze = yaw + eyeGaze.horizontalGaze;
    const totalVerticalGaze = pitch + eyeGaze.verticalGaze;

    let gazeDirection = 'Center';
    if (Math.abs(totalHorizontalGaze) > 22) {
      gazeDirection = totalHorizontalGaze > 0 ? 'Left' : 'Right';
    } else if (Math.abs(totalVerticalGaze) > 18) {
      gazeDirection = totalVerticalGaze > 0 ? 'Down' : 'Up';
    }

    const horizontalPenalty = Math.min(Math.abs(totalHorizontalGaze) / 40, 1);
    const verticalPenalty = Math.min(Math.abs(totalVerticalGaze) / 35, 1);
    const attentionScore = Math.max(0, 100 - (horizontalPenalty * 55 + verticalPenalty * 45));

    const isLookingAtCamera = attentionScore > 72;

    return {
      isLookingAtCamera,
      attentionScore,
      gazeDirection,
      yaw: yaw.toFixed(1),
      pitch: pitch.toFixed(1),
      eyeGazeH: eyeGaze.horizontalGaze.toFixed(1),
      eyeGazeV: eyeGaze.verticalGaze.toFixed(1)
    };
  }, [calculateEyeGaze]);

  /**
   * Detect emotion from facial landmarks and blendshapes
   */
  const detectEmotion = useCallback((landmarks, blendshapes) => {
    if (!blendshapes || blendshapes.length === 0) {
      return { emotion: 'Neutral', confidence: 0 };
    }

    const getBlendshapeValue = (name) => {
      const shape = blendshapes.find(b => b.categoryName === name);
      return shape ? shape.score : 0;
    };

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

    const leftEyeIndices = [33, 160, 158, 133, 153, 144];
    const rightEyeIndices = [362, 385, 387, 263, 373, 380];
    const leftEAR = calculateEAR(landmarks, leftEyeIndices);
    const rightEAR = calculateEAR(landmarks, rightEyeIndices);
    const avgEAR = (leftEAR + rightEAR) / 2;
    const mar = calculateMAR(landmarks);

    const avgSmile = (smileLeft + smileRight) / 2;
    const avgFrown = (mouthFrownLeft + mouthFrownRight) / 2;
    const avgEyeWide = (eyeWideLeft + eyeWideRight) / 2;
    const avgEyeSquint = (eyeSquintLeft + eyeSquintRight) / 2;
    const avgBrowDown = (browDownLeft + browDownRight) / 2;
    const avgBrowOuterUp = (browOuterUpLeft + browOuterUpRight) / 2;
    const avgCheekSquint = (cheekSquintLeft + cheekSquintRight) / 2;

    const emotions = {
      'Happy': Math.min(1, (
        avgSmile * 1.5 + 
        avgCheekSquint * 0.8 + 
        (mar > 0.3 ? 0.3 : 0)
      )),
      'Sad': Math.min(1, (
        avgFrown * 1.8 + 
        browInnerUp * 1.2 + 
        (avgEAR < 0.18 ? 0.5 : 0) + 
        (avgSmile < 0.1 ? 0.3 : -avgSmile * 0.5) + 
        (mouthPucker * 0.4)
      )),
      'Surprised': Math.min(1, (
        avgEyeWide * 1.8 + 
        browInnerUp * 0.5 + 
        avgBrowOuterUp * 0.5 + 
        jawOpen * 0.8 + 
        (avgEAR > 0.28 ? 0.4 : 0) + 
        (jawOpen > 0.3 ? 0.3 : -0.2)
      )),
      'Angry': Math.min(1, (
        avgBrowDown * 1.4 + 
        avgEyeSquint * 0.9 + 
        mouthPucker * 0.4 +
        (avgFrown * 0.3)
      )),
      'Neutral': 0
    };

    const maxOtherEmotion = Math.max(
      emotions.Happy,
      emotions.Sad,
      emotions.Surprised,
      emotions.Angry
    );
    
    emotions.Neutral = Math.max(0, 1 - maxOtherEmotion * 1.5);

    const threshold = 0.12;
    const surprisedThreshold = 0.25;
    Object.keys(emotions).forEach(key => {
      const minThreshold = key === 'Surprised' ? surprisedThreshold : threshold;
      if (emotions[key] < minThreshold && key !== 'Neutral') {
        emotions[key] = 0;
      }
    });

    let maxEmotion = 'Neutral';
    let maxConfidence = emotions.Neutral;

    for (const [emotion, score] of Object.entries(emotions)) {
      if (score > maxConfidence) {
        maxConfidence = score;
        maxEmotion = emotion;
      }
    }

    const scaledConfidence = Math.min(maxConfidence * 100, 100);

    return {
      emotion: maxEmotion,
      confidence: scaledConfidence
    };
  }, [calculateEAR, calculateMAR]);

  /**
   * Process video frame for face tracking
   */
  const processFrame = () => {
    if (!faceLandmarkerRef.current || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const startTimeMs = performance.now();
      const results = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const blendshapes = results.faceBlendshapes && results.faceBlendshapes.length > 0 
          ? results.faceBlendshapes[0].categories 
          : [];

        const attentionData = calculateAttention(landmarks);
        const emotionData = detectEmotion(landmarks, blendshapes);

        setCurrentAttention(attentionData);
        setCurrentEmotion(emotionData);

        // Send data through WebSocket (throttled in sendFacialData)
        if (isTrackingRef.current) {
          sendFacialData(attentionData, emotionData);
        }

        // Accumulate data for aggregate metrics
        if (isTrackingRef.current) {
          attentionScoresRef.current.push(attentionData.attentionScore);
          emotionDataRef.current.push({
            emotion: emotionData.emotion,
            confidence: emotionData.confidence,
            timestamp: performance.now() - trackingStartTimeRef.current
          });
        }
      }
    } catch (err) {
      console.error('Error processing frame:', err);
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  };

  /**
   * Start video capture
   */
  const startVideo = useCallback(async () => {
    try {
      setVideoError(null);
      console.log('Requesting camera access for match...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      
      console.log('Camera access granted');
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        const onLoadedMetadata = () => {
          console.log('Video metadata loaded');
          
          videoRef.current.play().then(() => {
            setIsVideoReady(true);
            console.log('Video playing, starting frame processing...');
            
            setTimeout(() => {
              processFrame();
            }, 100);
          }).catch(err => {
            console.error('Error playing video:', err);
            setVideoError('Failed to start video playback.');
          });
        };

        if (videoRef.current.readyState >= 2) {
          onLoadedMetadata();
        } else {
          videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setVideoError('Failed to access camera. Please ensure you have granted camera permissions.');
    }
  }, []);

  /**
   * Start face tracking
   */
  const startTracking = useCallback(() => {
    if (!isVideoReady || !faceLandmarkerRef.current) {
      console.warn('Cannot start tracking: video not ready or face landmarker not initialized');
      return;
    }

    attentionScoresRef.current = [];
    emotionDataRef.current = [];
    trackingStartTimeRef.current = performance.now();
    lastSentDataRef.current = null;
    
    setIsTracking(true);
    isTrackingRef.current = true;
    
    console.log('Face tracking started for match');
  }, [isVideoReady]);

  /**
   * Stop face tracking
   */
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    isTrackingRef.current = false;
    console.log('Face tracking stopped');
  }, []);

  /**
   * Stop video capture
   */
  const stopVideo = useCallback(() => {
    stopTracking();

    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsVideoReady(false);
    console.log('Video stopped');
  }, [stopTracking]);

  /**
   * Get aggregate tracking metrics
   */
  const getTrackingMetrics = useCallback(() => {
    const avgAttention = attentionScoresRef.current.length > 0
      ? attentionScoresRef.current.reduce((sum, score) => sum + score, 0) / attentionScoresRef.current.length
      : 0;

    const goodAttentionFrames = attentionScoresRef.current.filter(score => score > 60).length;
    const attentionPercentage = attentionScoresRef.current.length > 0
      ? (goodAttentionFrames / attentionScoresRef.current.length) * 100
      : 0;

    const emotionCounts = {};
    emotionDataRef.current.forEach(data => {
      emotionCounts[data.emotion] = (emotionCounts[data.emotion] || 0) + 1;
    });

    let dominantEmotion = 'Neutral';
    let maxCount = 0;
    Object.entries(emotionCounts).forEach(([emotion, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantEmotion = emotion;
      }
    });

    const dominantEmotionPercentage = emotionDataRef.current.length > 0
      ? (maxCount / emotionDataRef.current.length) * 100
      : 0;

    return {
      averageAttentionScore: avgAttention,
      attentionPercentage: attentionPercentage,
      dominantEmotion: dominantEmotion,
      dominantEmotionPercentage: dominantEmotionPercentage,
      totalFramesProcessed: attentionScoresRef.current.length,
      trackingDuration: trackingStartTimeRef.current 
        ? (performance.now() - trackingStartTimeRef.current) / 1000 
        : 0
    };
  }, []);

  /**
   * Reset tracking data
   */
  const resetTracking = useCallback(() => {
    attentionScoresRef.current = [];
    emotionDataRef.current = [];
    trackingStartTimeRef.current = null;
    lastSentDataRef.current = null;
    setCurrentAttention({
      isLookingAtCamera: false,
      attentionScore: 0,
      gazeDirection: 'Center'
    });
    setCurrentEmotion({
      emotion: 'Neutral',
      confidence: 0
    });
    setOpponentAttention({
      isLookingAtCamera: false,
      attentionScore: 0,
      gazeDirection: 'Center'
    });
    setOpponentEmotion({
      emotion: 'Neutral',
      confidence: 0
    });
    console.log('Tracking data reset');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVideo();
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
      }
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
    };
  }, [stopVideo]);

  return {
    // Video refs
    videoRef,
    canvasRef,
    
    // State
    isVideoReady,
    isTracking,
    videoError,
    faceLandmarker,
    
    // Current player data
    currentAttention,
    currentEmotion,
    
    // Opponent data (received via WebSocket)
    opponentAttention,
    opponentEmotion,
    
    // Control functions
    startVideo,
    stopVideo,
    startTracking,
    stopTracking,
    
    // Metrics
    getTrackingMetrics,
    resetTracking,
    
    // WebSocket handler for opponent data
    handleOpponentFacialData
  };
}
