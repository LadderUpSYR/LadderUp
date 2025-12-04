import React, { useState } from "react";
import { useDarkMode } from "../utils/useDarkMode";
import { usePracticeAudioCapture } from "./usePracticeAudioCapture";
import { usePracticeVideoCapture } from "./usePracticeVideoCapture";
import "../App.css";

/**
 * PracticeMode Component
 * A practice mode interface with two options:
 * - Text Mode: Answer questions via text input
 * - Video Mode: Answer questions via video/voice (to be implemented)
 */
function PracticeMode() {
    const { isDarkMode, toggleDarkMode } = useDarkMode();
    const [selectedMode, setSelectedMode] = useState(null); // null, 'text', or 'video'

    const handleBackToModeSelection = () => {
        setSelectedMode(null);
    };

    const handleBackToProfile = () => {
        try {
            window.history.pushState({}, '', '/profile');
            window.location.reload();
        } catch (e) {
            window.location.pathname = '/profile';
        }
    };

    // Render mode selection screen
    if (selectedMode === null) {
        return (
            <div className={`min-h-screen relative transition-colors duration-500 ${
                isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
            }`}>
                {/* Navigation */}
                <nav className={`shadow-lg border-b transition-colors duration-500 ${
                    isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
                }`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center gap-2 sm:gap-4">
                                <button
                                    onClick={handleBackToProfile}
                                    className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg transition-colors duration-200 text-sm sm:text-base ${
                                        isDarkMode 
                                            ? 'text-gray-300 hover:text-sky-blue hover:bg-gray-800' 
                                            : 'text-gray-700 hover:text-sky-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back
                                </button>
                                <h1 className={`text-lg sm:text-2xl font-bold transition-colors duration-500 ${
                                    isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                                }`}>Practice Mode</h1>
                            </div>
                            <button
                                onClick={toggleDarkMode}
                                className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    isDarkMode 
                                        ? 'bg-sky-blue focus:ring-sky-blue' 
                                        : 'bg-gray-300 focus:ring-sky-600'
                                }`}
                                aria-label="Toggle theme"
                            >
                                <span
                                    className={`inline-block w-6 h-6 transform transition-transform duration-300 ease-in-out rounded-full shadow-lg ${
                                        isDarkMode 
                                            ? 'translate-x-9 bg-gray-900' 
                                            : 'translate-x-1 bg-white'
                                    }`}
                                >
                                    <span className="flex items-center justify-center h-full">
                                        {isDarkMode ? (
                                            <svg className="w-4 h-4 text-sky-blue" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </span>
                                </span>
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
                    <div className="text-center mb-8 sm:mb-12">
                        <p className={`text-base sm:text-xl transition-colors duration-500 px-4 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                            Choose your practice mode to sharpen your interview skills
                        </p>
                    </div>

                        {/* Mode Selection Cards */}
                        <div className="grid md:grid-cols-2 gap-4 sm:gap-8">
                            {/* Text Mode Card */}
                            <div
                                onClick={() => setSelectedMode('text')}
                                className={`relative group cursor-pointer rounded-2xl p-6 sm:p-8 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${
                                    isDarkMode
                                        ? 'bg-gray-800 hover:bg-gray-750'
                                        : 'bg-white hover:bg-gray-50'
                                } shadow-xl border-2 ${
                                    isDarkMode ? 'border-gray-700' : 'border-gray-200'
                                } hover:border-sky-500`}
                            >
                                <div className="text-center">
                                    <div className={`mb-4 flex justify-center`}>
                                        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${
                                            isDarkMode ? 'bg-sky-blue/20' : 'bg-sky-500/20'
                                        }`}>
                                            <svg className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors duration-300 ${
                                                isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </div>
                                    </div>
                                    <h3 className={`text-2xl font-bold mb-3 transition-colors duration-500 ${
                                        isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                                    }`}>
                                        Text Mode
                                    </h3>
                                    <p className={`text-base mb-6 transition-colors duration-500 ${
                                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                        Practice answering interview questions through text responses.
                                        Get instant AI feedback on your answers.
                                    </p>
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                                        isDarkMode
                                            ? 'bg-sky-blue text-black group-hover:bg-sky-400'
                                            : 'bg-sky-600 text-white group-hover:bg-sky-700'
                                    }`}>
                                        Start Text Practice
                                        <span className="transform transition-transform duration-300 group-hover:translate-x-1">
                                            →
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Video Mode Card (Coming Soon) */}
                            <div
                                onClick={() => setSelectedMode('audio')}
                                className={`relative group cursor-pointer rounded-2xl p-8 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${
                                    isDarkMode
                                        ? 'bg-gray-800 hover:bg-gray-750'
                                        : 'bg-white hover:bg-gray-50'
                                } shadow-xl border-2 ${
                                    isDarkMode ? 'border-gray-700' : 'border-gray-200'
                                } hover:border-sky-500`}
                            >
                                <div className="text-center">
                                    <div className={`mb-4 flex justify-center`}>
                                        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${
                                            isDarkMode ? 'bg-purple-500/20' : 'bg-purple-500/20'
                                        }`}>
                                            <svg className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors duration-300 ${
                                                isDarkMode ? 'text-purple-400' : 'text-purple-600'
                                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                            </svg>
                                        </div>
                                    </div>
                                    <h3 className={`text-2xl font-bold mb-3 transition-colors duration-500 ${
                                        isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                                    }`}>
                                        Audio Mode
                                    </h3>
                                    <p className={`text-base mb-6 transition-colors duration-500 ${
                                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                        Practice with voice responses and real-time transcription.
                                        Experience realistic interview scenarios.
                                    </p>
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                                        isDarkMode
                                            ? 'bg-sky-blue text-black group-hover:bg-sky-400'
                                            : 'bg-sky-600 text-white group-hover:bg-sky-700'
                                    }`}>
                                        Start Audio Practice
                                        <span className="transform transition-transform duration-300 group-hover:translate-x-1">
                                            →
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Feature highlights */}
                        <div className="mt-12 text-center">
                            <div className={`inline-block rounded-2xl p-6 ${
                                isDarkMode ? 'bg-gray-800' : 'bg-white'
                            } shadow-xl`}>
                                <h4 className={`text-lg font-semibold mb-4 ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                    Practice Features
                                </h4>
                                <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-8">
                                    <div className="flex items-center gap-3">
                                        <svg className={`w-6 h-6 flex-shrink-0 ${isDarkMode ? 'text-sky-blue' : 'text-sky-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        <span className={`text-sm sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            AI-Powered Feedback
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <svg className={`w-6 h-6 flex-shrink-0 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        <span className={`text-sm sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Detailed Scoring
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <svg className={`w-6 h-6 flex-shrink-0 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        <span className={`text-sm sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Improvement Tips
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>
            </div>
        );
    }

    // Render Text Mode
    if (selectedMode === 'text') {
        return <TextPracticeMode onBack={handleBackToModeSelection} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />;
    }

    // Render Audio Mode
    if (selectedMode === 'audio') {
        return <AudioPracticeMode onBack={handleBackToModeSelection} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />;
    }

    return null;
}

/**
 * TextPracticeMode Component
 * Text-based practice mode with question fetching and answer submission
 */
function TextPracticeMode({ onBack, isDarkMode, toggleDarkMode }) {
    const [question, setQuestion] = useState("");
    const [answerCriteria, setAnswerCriteria] = useState("");
    const [error, setError] = useState("");
    const [answer, setAnswer] = useState("");
    const [currentQuestionId, setCurrentQuestionId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);
    const [poorlyAnswered, setPoorlyAnswered] = useState([]); // Questions scored < 7

    const getRandomQuestion = async () => {
        try {
            const result = await fetch(`/api/question/random`, {
                method: "GET",
                credentials: "include",
            });

            if (!result.ok) throw new Error("Failed to fetch random question");

            const data = await result.json();
            setQuestion(data.question);
            setAnswerCriteria(data.answerCriteria || "");
            setCurrentQuestionId(data.questionId || "random-" + Date.now());
            setAnswer("");
            setSubmitResult(null);
            setError("");
        } catch (err) {
            console.error(err);
            setError(err.message);
        }
    };

    const submitAnswer = async () => {
        if (!answer.trim()) {
            setError("Please enter an answer before submitting");
            return;
        }

        if (!question) {
            setError("Please select a question first");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const result = await fetch(`/api/question/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    questionId: currentQuestionId,
                    question: question,
                    answer: answer,
                    answerCriteria: answerCriteria,
                }),
            });

            if (!result.ok) {
                const err = await result.json();
                throw new Error(err.detail || "Failed to submit answer");
            }

            const data = await result.json();
            const score = data.grading?.score || data.answer_record?.score || 0;
            
            setSubmitResult({
                success: true,
                score: score,
                feedback: data.grading?.feedback || "Answer graded successfully",
                strengths: data.grading?.strengths || [],
                improvements: data.grading?.improvements || [],
                message: data.msg,
                totalAnswered: data.total_answered
            });
            
            // Track poorly answered questions (score < 7) for retry
            if (score < 7 && currentQuestionId) {
                const questionData = {
                    id: currentQuestionId,
                    question: question,
                    answerCriteria: answerCriteria,
                    score: score
                };
                
                // Check if already in the list
                setPoorlyAnswered(prev => {
                    const exists = prev.some(q => q.id === currentQuestionId);
                    if (!exists) {
                        return [...prev, questionData];
                    }
                    return prev;
                });
            }
            
            // Clear the answer field after successful submission
            setAnswer("");
        } catch (err) {
            console.error(err);
            setError(err.message);
            setSubmitResult({ success: false });
        } finally {
            setSubmitting(false);
        }
    };

    const retryPoorQuestion = (questionData) => {
        setQuestion(questionData.question);
        setAnswerCriteria(questionData.answerCriteria);
        setCurrentQuestionId(questionData.id);
        setAnswer("");
        setSubmitResult(null);
        setError("");
    };

    return (
        <div className={`min-h-screen relative transition-colors duration-500 ${
            isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
        }`}>

            {/* Navigation */}
            <nav className={`shadow-lg border-b transition-colors duration-500 ${
                isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
            }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                                    isDarkMode 
                                        ? 'text-gray-300 hover:text-sky-blue hover:bg-gray-800' 
                                        : 'text-gray-700 hover:text-sky-600 hover:bg-gray-100'
                                }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                            <h1 className={`text-2xl font-bold transition-colors duration-500 ${
                                isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                            }`}>Text Practice</h1>
                        </div>
                        <button
                            onClick={toggleDarkMode}
                            className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                isDarkMode 
                                    ? 'bg-sky-blue focus:ring-sky-blue' 
                                    : 'bg-gray-300 focus:ring-sky-600'
                            }`}
                            aria-label="Toggle theme"
                        >
                            <span
                                className={`inline-block w-6 h-6 transform transition-transform duration-300 ease-in-out rounded-full shadow-lg ${
                                    isDarkMode 
                                        ? 'translate-x-9 bg-gray-900' 
                                        : 'translate-x-1 bg-white'
                                }`}
                            >
                                <span className="flex items-center justify-center h-full">
                                    {isDarkMode ? (
                                        <svg className="w-4 h-4 text-sky-blue" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </span>
                            </span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Main Content */}
                <div className="max-w-3xl mx-auto">
                    {/* Question Selection */}
                    <div className={`rounded-2xl p-6 mb-6 shadow-xl transition-colors duration-500 ${
                        isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                        <h3 className={`text-lg font-semibold mb-4 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                            Get a Question
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {/* Get Random Question */}
                            <button
                                onClick={getRandomQuestion}
                                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                                    isDarkMode
                                        ? 'bg-sky-blue text-black hover:bg-sky-400'
                                        : 'bg-sky-600 text-white hover:bg-sky-700'
                                }`}
                            >
                                Random Question
                            </button>

                            {/* Next Question */}
                            <button
                                onClick={getRandomQuestion}
                                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                                    isDarkMode
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                            >
                                Next Question
                            </button>
                        </div>
                    </div>

                    {/* Retry Poor Questions Section */}
                    {poorlyAnswered.length > 0 && (
                        <div className={`rounded-2xl p-6 mb-6 shadow-xl transition-colors duration-500 ${
                            isDarkMode ? 'bg-gradient-to-br from-orange-900/30 to-red-900/30 border-2 border-orange-500' : 'bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-400'
                        }`}>
                            <h3 className={`text-lg font-semibold mb-3 ${
                                isDarkMode ? 'text-orange-400' : 'text-orange-700'
                            }`}>
                                Practice Weak Areas
                            </h3>
                            <p className={`text-sm mb-4 ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                                Retry questions where you scored below 7/10 to improve your skills
                            </p>
                            <div className="space-y-2">
                                {poorlyAnswered.map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => retryPoorQuestion(q)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 hover:scale-102 ${
                                            isDarkMode
                                                ? 'bg-gray-800 hover:bg-gray-750 text-gray-300'
                                                : 'bg-white hover:bg-gray-50 text-gray-800'
                                        } shadow-md border ${
                                            isDarkMode ? 'border-gray-700' : 'border-gray-200'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="flex-1 truncate">{q.question}</span>
                                            <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                                                isDarkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {q.score.toFixed(1)}/10
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className={`rounded-lg p-4 mb-6 ${
                            isDarkMode ? 'bg-red-900/30 border border-red-500' : 'bg-red-50 border border-red-200'
                        }`}>
                            <p className="text-red-500 font-semibold">{error}</p>
                        </div>
                    )}

                    {/* Question Display */}
                    <div className={`rounded-2xl p-6 mb-6 shadow-xl transition-colors duration-500 ${
                        isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                        <h3 className={`text-lg font-semibold mb-3 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                            Question:
                        </h3>
                        {question ? (
                            <p className={`text-lg leading-relaxed ${
                                isDarkMode ? 'text-gray-300' : 'text-gray-800'
                            }`}>
                                {question}
                            </p>
                        ) : (
                            <p className={`text-base italic ${
                                isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                                No question selected yet. Get a random question or enter a question ID.
                            </p>
                        )}
                    </div>

                    {/* Answer Input and Submit */}
                    {question && (
                        <div className={`rounded-2xl p-6 mb-6 shadow-xl transition-colors duration-500 ${
                            isDarkMode ? 'bg-gray-800' : 'bg-white'
                        }`}>
                            <h3 className={`text-lg font-semibold mb-3 ${
                                isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                                Your Answer:
                            </h3>
                            <textarea
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Type your answer here..."
                                className={`w-full px-4 py-3 rounded-lg min-h-[150px] transition-colors duration-500 ${
                                    isDarkMode
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                        : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                                } border focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none`}
                                disabled={submitting}
                            />

                            <button
                                onClick={submitAnswer}
                                disabled={submitting || !answer.trim()}
                                className={`w-full mt-4 px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                                    submitting || !answer.trim()
                                        ? isDarkMode
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : isDarkMode
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                            >
                                {submitting ? "Submitting..." : "Submit Answer"}
                            </button>
                        </div>
                    )}

                    {/* Grading Results */}
                    {submitResult && submitResult.success && (
                        <div className={`rounded-2xl p-6 shadow-xl transition-colors duration-500 ${
                            isDarkMode
                                ? 'bg-gradient-to-br from-green-900/30 to-blue-900/30 border-2 border-green-500'
                                : 'bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-400'
                        }`}>
                            <h4 className={`font-bold text-2xl mb-4 ${
                                isDarkMode ? 'text-green-400' : 'text-green-800'
                            }`}>
                                Answer Graded!
                            </h4>
                            
                            {/* Score */}
                            <div className={`mb-4 p-4 rounded-lg shadow-sm transition-colors duration-500 ${
                                isDarkMode ? 'bg-gray-800' : 'bg-white'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <span className={`text-lg font-semibold ${
                                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                        Your Score:
                                    </span>
                                    <span className={`text-3xl font-bold ${
                                        isDarkMode ? 'text-sky-blue' : 'text-green-600'
                                    }`}>
                                        {submitResult.score.toFixed(1)}/10
                                    </span>
                                </div>
                            </div>

                            {/* Feedback */}
                            {submitResult.feedback && (
                                <div className={`mb-4 p-4 rounded-lg shadow-sm transition-colors duration-500 ${
                                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                                }`}>
                                    <h5 className={`font-semibold mb-2 ${
                                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                        Feedback:
                                    </h5>
                                    <p className={`text-sm leading-relaxed ${
                                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                        {submitResult.feedback}
                                    </p>
                                </div>
                            )}

                            {/* Strengths */}
                            {submitResult.strengths && submitResult.strengths.length > 0 && (
                                <div className={`mb-4 p-4 rounded-lg shadow-sm transition-colors duration-500 ${
                                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                                }`}>
                                    <h5 className={`font-semibold mb-2 ${
                                        isDarkMode ? 'text-green-400' : 'text-green-700'
                                    }`}>
                                        Strengths:
                                    </h5>
                                    <ul className="list-disc list-inside space-y-1">
                                        {submitResult.strengths.map((strength, idx) => (
                                            <li key={idx} className={`text-sm ${
                                                isDarkMode ? 'text-green-400' : 'text-green-600'
                                            }`}>
                                                {strength}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Improvements */}
                            {submitResult.improvements && submitResult.improvements.length > 0 && (
                                <div className={`mb-4 p-4 rounded-lg shadow-sm transition-colors duration-500 ${
                                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                                }`}>
                                    <h5 className={`font-semibold mb-2 ${
                                        isDarkMode ? 'text-blue-400' : 'text-blue-700'
                                    }`}>
                                        Areas for Improvement:
                                    </h5>
                                    <ul className="list-disc list-inside space-y-1">
                                        {submitResult.improvements.map((improvement, idx) => (
                                            <li key={idx} className={`text-sm ${
                                                isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                            }`}>
                                                {improvement}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Stats */}
                            <div className={`mt-4 pt-3 border-t ${
                                isDarkMode ? 'border-gray-700' : 'border-gray-300'
                            }`}>
                                <p className={`text-sm ${
                                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                    Total questions answered: <span className="font-semibold">{submitResult.totalAnswered}</span>
                                </p>
                                <p className={`text-xs mt-1 ${
                                    isDarkMode ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                    Graded by AI • Check your profile to see all answered questions
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * AudioPracticeMode Component
 * Audio/video-based practice mode with voice recording, transcription, face tracking, and answer submission
 * Integrates facial tracking for attention and emotion analysis
 */
function AudioPracticeMode({ onBack, isDarkMode, toggleDarkMode }) {
    const [question, setQuestion] = useState("");
    const [answerCriteria, setAnswerCriteria] = useState("");
    const [error, setError] = useState("");
    const [currentQuestionId, setCurrentQuestionId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);
    const [poorlyAnswered, setPoorlyAnswered] = useState([]); // Questions scored < 7
    const [videoEnabled, setVideoEnabled] = useState(false);
    
    // Audio capture hook
    const {
        isRecording,
        transcript,
        interimTranscript,
        audioError,
        isSupported,
        toggleRecording,
        clearTranscript,
        resetWhileRecording
    } = usePracticeAudioCapture();

    // Video capture hook
    const {
        videoRef,
        canvasRef,
        isVideoReady,
        isTracking,
        videoError,
        faceLandmarker,
        currentAttention,
        currentEmotion,
        startVideo,
        stopVideo,
        startTracking,
        stopTracking,
        getTrackingMetrics,
        resetTracking
    } = usePracticeVideoCapture();

    const getRandomQuestion = async () => {
        try {
            const result = await fetch(`/api/question/random`, {
                method: "GET",
                credentials: "include",
            });

            if (!result.ok) throw new Error("Failed to fetch random question");

            const data = await result.json();
            setQuestion(data.question);
            setAnswerCriteria(data.answerCriteria || "");
            setCurrentQuestionId(data.questionId || "random-" + Date.now());
            clearTranscript();
            resetTracking();
            setSubmitResult(null);
            setError("");
        } catch (err) {
            console.error(err);
            setError(err.message);
        }
    };

    const handleToggleRecording = async () => {
        if (!isRecording) {
            // Starting recording
            // Reset tracking data first to ensure we start fresh
            if (videoEnabled && isVideoReady) {
                resetTracking();
                console.log('Reset tracking before starting recording');
            }
            
            toggleRecording();
            
            // Start video tracking if video is enabled and ready
            if (videoEnabled && isVideoReady && !isTracking) {
                startTracking();
            }
        } else {
            // Stopping recording
            toggleRecording();
            
            // Stop video tracking but DON'T reset yet - we need the data for submission
            if (isTracking) {
                stopTracking();
            }
        }
    };

    const handleToggleVideo = async () => {
        if (!videoEnabled) {
            // Enable video
            setVideoEnabled(true);
            await startVideo();
        } else {
            // Disable video
            if (isTracking) {
                stopTracking();
            }
            stopVideo();
            setVideoEnabled(false);
        }
    };

    const submitAnswer = async () => {
        const fullTranscript = transcript.trim();
        
        if (!fullTranscript) {
            setError("Please record an answer before submitting");
            return;
        }

        if (!question) {
            setError("Please select a question first");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            // Get video analytics if tracking was used
            let videoAnalytics = null;
            if (videoEnabled && isVideoReady) {
                videoAnalytics = getTrackingMetrics();
                console.log("Video analytics:", videoAnalytics);
            }

            const result = await fetch(`/api/question/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    questionId: currentQuestionId,
                    question: question,
                    answer: fullTranscript, // Use transcript as answer
                    answerCriteria: answerCriteria,
                    videoAnalytics: videoAnalytics  // Include video analytics
                }),
            });

            if (!result.ok) {
                const err = await result.json();
                throw new Error(err.detail || "Failed to submit answer");
            }

            const data = await result.json();
            const score = data.grading?.score || data.answer_record?.score || 0;
            
            setSubmitResult({
                success: true,
                score: score,
                feedback: data.grading?.feedback || "Answer graded successfully",
                strengths: data.grading?.strengths || [],
                improvements: data.grading?.improvements || [],
                message: data.msg,
                totalAnswered: data.total_answered,
                videoMetrics: videoAnalytics  // Store video metrics in result
            });
            
            // Track poorly answered questions (score < 7) for retry
            if (score < 7 && currentQuestionId) {
                const questionData = {
                    id: currentQuestionId,
                    question: question,
                    answerCriteria: answerCriteria,
                    score: score
                };
                
                setPoorlyAnswered(prev => {
                    const exists = prev.some(q => q.id === currentQuestionId);
                    if (!exists) {
                        return [...prev, questionData];
                    }
                    return prev;
                });
            }
            
            // Clear transcript after successful submission
            clearTranscript();
            
            // Reset tracking data after successful submission
            if (videoEnabled) {
                resetTracking();
                console.log('Reset tracking after submission');
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
            setSubmitResult({ success: false });
        } finally {
            setSubmitting(false);
        }
    };

    const retryPoorQuestion = (questionData) => {
        setQuestion(questionData.question);
        setAnswerCriteria(questionData.answerCriteria);
        setCurrentQuestionId(questionData.id);
        clearTranscript();
        setSubmitResult(null);
        setError("");
    };

    return (
        <div className={`min-h-screen relative transition-colors duration-500 ${
            isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
        }`}>
            {/* Navigation */}
            <nav className={`shadow-lg border-b transition-colors duration-500 ${
                isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
            }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                                    isDarkMode 
                                        ? 'text-gray-300 hover:text-sky-blue hover:bg-gray-800' 
                                        : 'text-gray-700 hover:text-sky-600 hover:bg-gray-100'
                                }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                            <h1 className={`text-2xl font-bold transition-colors duration-500 ${
                                isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                            }`}>Audio Practice</h1>
                        </div>
                        <button
                            onClick={toggleDarkMode}
                            className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                isDarkMode 
                                    ? 'bg-sky-blue focus:ring-sky-blue' 
                                    : 'bg-gray-300 focus:ring-sky-600'
                            }`}
                            aria-label="Toggle theme"
                        >
                            <span
                                className={`inline-block w-6 h-6 transform transition-transform duration-300 ease-in-out rounded-full shadow-lg ${
                                    isDarkMode 
                                        ? 'translate-x-9 bg-gray-900' 
                                        : 'translate-x-1 bg-white'
                                }`}
                            >
                                <span className="flex items-center justify-center h-full">
                                    {isDarkMode ? (
                                        <svg className="w-4 h-4 text-sky-blue" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </span>
                            </span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="max-w-5xl mx-auto">
                    {/* Browser support warning */}
                    {!isSupported && (
                        <div className={`rounded-lg p-4 mb-6 ${
                            isDarkMode ? 'bg-yellow-900/30 border border-yellow-500' : 'bg-yellow-50 border border-yellow-200'
                        }`}>
                            <p className="text-yellow-600 font-semibold">Speech recognition not supported in this browser. Please use Chrome or Edge for audio practice.</p>
                        </div>
                    )}

                    {/* Question Selection */}
                    <div className={`rounded-2xl p-6 mb-6 shadow-xl transition-colors duration-500 ${
                        isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                        <h3 className={`text-lg font-semibold mb-4 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                            Get a Question
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={getRandomQuestion}
                                disabled={isRecording}
                                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                                    isRecording
                                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                        : isDarkMode
                                            ? 'bg-sky-blue text-black hover:bg-sky-400'
                                            : 'bg-sky-600 text-white hover:bg-sky-700'
                                }`}
                            >
                                Random Question
                            </button>

                            <button
                                onClick={getRandomQuestion}
                                disabled={isRecording}
                                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                                    isRecording
                                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                        : isDarkMode
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                            >
                                Next Question
                            </button>
                        </div>
                    </div>

                    {/* Retry Poor Questions Section */}
                    {poorlyAnswered.length > 0 && (
                        <div className={`rounded-2xl p-6 mb-6 shadow-xl transition-colors duration-500 ${
                            isDarkMode ? 'bg-gradient-to-br from-orange-900/30 to-red-900/30 border-2 border-orange-500' : 'bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-400'
                        }`}>
                            <h3 className={`text-lg font-semibold mb-3 ${
                                isDarkMode ? 'text-orange-400' : 'text-orange-700'
                            }`}>
                                Practice Weak Areas
                            </h3>
                            <p className={`text-sm mb-4 ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                                Retry questions where you scored below 7/10 to improve your skills
                            </p>
                            <div className="space-y-2">
                                {poorlyAnswered.map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => retryPoorQuestion(q)}
                                        disabled={isRecording}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 ${
                                            isRecording
                                                ? 'opacity-50 cursor-not-allowed'
                                                : 'hover:scale-102'
                                        } ${
                                            isDarkMode
                                                ? 'bg-gray-800 hover:bg-gray-750 text-gray-300'
                                                : 'bg-white hover:bg-gray-50 text-gray-800'
                                        } shadow-md border ${
                                            isDarkMode ? 'border-gray-700' : 'border-gray-200'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="flex-1 truncate">{q.question}</span>
                                            <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                                                isDarkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {q.score.toFixed(1)}/10
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {(error || audioError) && (
                        <div className={`rounded-lg p-4 mb-6 ${
                            isDarkMode ? 'bg-red-900/30 border border-red-500' : 'bg-red-50 border border-red-200'
                        }`}>
                            <p className="text-red-500 font-semibold">{error || audioError}</p>
                        </div>
                    )}

                    {/* Question Display */}
                    <div className={`rounded-2xl p-6 mb-6 shadow-xl transition-colors duration-500 ${
                        isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                        <h3 className={`text-lg font-semibold mb-3 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                            Question:
                        </h3>
                        {question ? (
                            <p className={`text-lg leading-relaxed ${
                                isDarkMode ? 'text-gray-300' : 'text-gray-800'
                            }`}>
                                {question}
                            </p>
                        ) : (
                            <p className={`text-base italic ${
                                isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                                No question selected yet. Get a random question to start practicing.
                            </p>
                        )}
                    </div>

                    {/* Video/Audio Recording Area */}
                    {question && (
                        <div className={`rounded-2xl p-6 mb-6 shadow-xl transition-colors duration-500 ${
                            isDarkMode ? 'bg-gray-800' : 'bg-white'
                        }`}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className={`text-lg font-semibold ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                    Your Response
                                </h3>
                                <button
                                    onClick={handleToggleVideo}
                                    disabled={isRecording || submitting}
                                    className={`text-sm px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                                        isRecording || submitting
                                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                            : videoEnabled
                                                ? isDarkMode
                                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                                    : 'bg-red-500 text-white hover:bg-red-600'
                                                : isDarkMode
                                                    ? 'bg-sky-blue text-black hover:bg-sky-400'
                                                    : 'bg-sky-600 text-white hover:bg-sky-700'
                                    }`}
                                >
                                    {videoEnabled ? 'Audio Only' : 'Enable Video Tracking'}
                                </button>
                            </div>

                            {/* Video with Face Tracking */}
                            {videoEnabled && (
                                <div className="mb-4 space-y-3">
                                    <div className={`rounded-lg overflow-hidden border-2 ${
                                        isDarkMode ? 'border-gray-700' : 'border-gray-300'
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
                                                style={{ maxHeight: '400px' }}
                                            />
                                            
                                            {!isVideoReady && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                                                    <div className="text-center">
                                                        <p className="text-white text-lg mb-2">Starting camera...</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Real-time Video Metrics Display */}
                                    {isVideoReady && (
                                        <div className={`rounded-lg p-4 ${
                                            isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                                        }`}>
                                            {/* Attention Score */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <span className={`text-sm font-semibold block ${
                                                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                                        }`}>
                                                            Attention Score
                                                        </span>
                                                        <span className={`text-xs ${
                                                            currentAttention.isLookingAtCamera
                                                                ? 'text-green-500'
                                                                : 'text-red-500'
                                                        }`}>
                                                            {currentAttention.isLookingAtCamera ? 'Looking at camera' : '✗ Not looking'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`flex items-baseline gap-1 ${
                                                    isDarkMode ? 'text-sky-blue' : 'text-sky-600'
                                                }`}>
                                                    <span className="text-3xl font-bold">
                                                        {currentAttention.attentionScore.toFixed(0)}
                                                    </span>
                                                    <span className="text-sm">/ 100</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Video Error */}
                                    {videoError && (
                                        <div className={`rounded-lg p-3 ${
                                            isDarkMode ? 'bg-red-900/30' : 'bg-red-50'
                                        }`}>
                                            <p className="text-red-500 text-sm">{videoError}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Recording Controls */}
                            <div className="flex justify-center items-center gap-4 mb-4">
                                <button
                                    onClick={handleToggleRecording}
                                    disabled={!isSupported || submitting}
                                    className={`px-8 py-4 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                                        !isSupported || submitting
                                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                            : isRecording
                                                ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                                                : isDarkMode
                                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                                    : 'bg-green-500 text-white hover:bg-green-600'
                                    }`}
                                >
                                    {isRecording ? (
                                        <>
                                            <span className="inline-block w-3 h-3 bg-white rounded-full mr-2 animate-pulse"></span>
                                            Stop Recording
                                        </>
                                    ) : (
                                        <>
                                            Start Recording
                                        </>
                                    )}
                                </button>
                                
                                {/* Clear/Reset Button */}
                                {(transcript || interimTranscript) && (
                                    <button
                                        onClick={() => {
                                            resetWhileRecording();
                                            resetTracking();
                                        }}
                                        disabled={submitting}
                                        className={`px-6 py-4 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                                            submitting
                                                ? 'bg-gray-500 text-gray-400 cursor-not-allowed opacity-50'
                                                : isDarkMode
                                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                                    : 'bg-red-500 text-white hover:bg-red-600'
                                        }`}
                                        title="Clear transcript and start over"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Transcription Display */}
                            <div className="relative">
                                <div className={`rounded-lg p-4 min-h-[150px] max-h-[300px] overflow-y-auto ${
                                    isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                                }`}>
                                    <p className={`leading-relaxed ${
                                        isDarkMode ? 'text-gray-300' : 'text-gray-800'
                                    }`}>
                                        {transcript || interimTranscript ? (
                                            <>
                                                {transcript}
                                                {interimTranscript && (
                                                    <span className={isDarkMode ? 'text-gray-500 italic' : 'text-gray-400 italic'}>
                                                        {interimTranscript}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className={`italic ${
                                                isDarkMode ? 'text-gray-600' : 'text-gray-400'
                                            }`}>
                                                {isRecording 
                                                    ? 'Listening... Start speaking to see your transcription here.'
                                                    : 'Click "Start Recording" and speak your answer. Your words will appear here in real-time.'}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                onClick={submitAnswer}
                                disabled={submitting || !transcript.trim() || isRecording}
                                className={`w-full mt-4 px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                                    submitting || !transcript.trim() || isRecording
                                        ? isDarkMode
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : isDarkMode
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                            >
                                {submitting ? "Submitting..." : isRecording ? "Stop recording to submit" : "Submit Answer"}
                            </button>
                        </div>
                    )}

                    {/* Grading Results */}
                    {submitResult && submitResult.success && (
                        <div className={`rounded-2xl p-6 shadow-xl transition-colors duration-500 ${
                            isDarkMode
                                ? 'bg-gradient-to-br from-green-900/30 to-blue-900/30 border-2 border-green-500'
                                : 'bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-400'
                        }`}>
                            <h4 className={`font-bold text-2xl mb-4 ${
                                isDarkMode ? 'text-green-400' : 'text-green-800'
                            }`}>
                                Answer Graded!
                            </h4>
                            
                            {/* Score */}
                            <div className={`mb-4 p-4 rounded-lg shadow-sm transition-colors duration-500 ${
                                isDarkMode ? 'bg-gray-800' : 'bg-white'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <span className={`text-lg font-semibold ${
                                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                        Your Score:
                                    </span>
                                    <span className={`text-3xl font-bold ${
                                        isDarkMode ? 'text-sky-blue' : 'text-green-600'
                                    }`}>
                                        {submitResult.score.toFixed(1)}/10
                                    </span>
                                </div>
                            </div>

                            {/* Feedback */}
                            {submitResult.feedback && (
                                <div className={`mb-4 p-4 rounded-lg shadow-sm transition-colors duration-500 ${
                                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                                }`}>
                                    <h5 className={`font-semibold mb-2 ${
                                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                        Feedback:
                                    </h5>
                                    <p className={`text-sm leading-relaxed ${
                                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                        {submitResult.feedback}
                                    </p>
                                </div>
                            )}

                            {/* Video Metrics */}
                            {submitResult.videoMetrics && (
                                <div className={`mb-4 p-4 rounded-lg shadow-sm transition-colors duration-500 ${
                                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                                }`}>
                                    <h5 className={`font-semibold mb-3 ${
                                        isDarkMode ? 'text-purple-400' : 'text-purple-700'
                                    }`}>
                                        Video Analysis
                                    </h5>
                                    {/* Attention Score */}
                                    <div className={`rounded p-4 ${
                                        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-sm font-semibold ${
                                                isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                            }`}>
                                                Eye Contact & Attention
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-2 mb-2">
                                            <span className={`text-3xl font-bold ${
                                                submitResult.videoMetrics.averageAttentionScore > 70
                                                    ? 'text-green-500'
                                                    : submitResult.videoMetrics.averageAttentionScore > 50
                                                    ? 'text-yellow-500'
                                                    : 'text-red-500'
                                            }`}>
                                                {submitResult.videoMetrics.averageAttentionScore.toFixed(0)}
                                            </span>
                                            <span className={`text-lg ${
                                                isDarkMode ? 'text-gray-500' : 'text-gray-600'
                                            }`}>
                                                / 100
                                            </span>
                                        </div>
                                        <p className={`text-sm ${
                                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                        }`}>
                                            You maintained eye contact <span className="font-semibold">{submitResult.videoMetrics.attentionPercentage.toFixed(0)}%</span> of the time
                                        </p>
                                    </div>
                                    <p className={`text-xs mt-3 italic ${
                                        isDarkMode ? 'text-gray-500' : 'text-gray-500'
                                    }`}>
                                        This metric was analyzed and incorporated into your grade
                                    </p>
                                </div>
                            )}

                            {/* Strengths */}
                            {submitResult.strengths && submitResult.strengths.length > 0 && (
                                <div className={`mb-4 p-4 rounded-lg shadow-sm transition-colors duration-500 ${
                                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                                }`}>
                                    <h5 className={`font-semibold mb-2 ${
                                        isDarkMode ? 'text-green-400' : 'text-green-700'
                                    }`}>
                                        Strengths:
                                    </h5>
                                    <ul className="list-disc list-inside space-y-1">
                                        {submitResult.strengths.map((strength, idx) => (
                                            <li key={idx} className={`text-sm ${
                                                isDarkMode ? 'text-green-400' : 'text-green-600'
                                            }`}>
                                                {strength}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Improvements */}
                            {submitResult.improvements && submitResult.improvements.length > 0 && (
                                <div className={`mb-4 p-4 rounded-lg shadow-sm transition-colors duration-500 ${
                                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                                }`}>
                                    <h5 className={`font-semibold mb-2 ${
                                        isDarkMode ? 'text-blue-400' : 'text-blue-700'
                                    }`}>
                                        Areas for Improvement:
                                    </h5>
                                    <ul className="list-disc list-inside space-y-1">
                                        {submitResult.improvements.map((improvement, idx) => (
                                            <li key={idx} className={`text-sm ${
                                                isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                            }`}>
                                                {improvement}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Stats */}
                            <div className={`mt-4 pt-3 border-t ${
                                isDarkMode ? 'border-gray-700' : 'border-gray-300'
                            }`}>
                                <p className={`text-sm ${
                                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                    Total questions answered: <span className="font-semibold">{submitResult.totalAnswered}</span>
                                </p>
                                <p className={`text-xs mt-1 ${
                                    isDarkMode ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                    Graded by AI • Check your profile to see all answered questions
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PracticeMode;