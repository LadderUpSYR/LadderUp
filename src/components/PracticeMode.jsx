import React, { useState } from "react";
import { useDarkMode } from "../utils/useDarkMode";
import { usePracticeAudioCapture } from "./usePracticeAudioCapture";
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
            <div className={`min-h-screen relative overflow-hidden transition-colors duration-500 ${
                isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
            }`}>
                {/* Animated background */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    {[...Array(30)].map((_, i) => (
                        <div
                            key={i}
                            className={`absolute w-1 h-1 rounded-full opacity-20 animate-float ${
                                isDarkMode ? 'bg-sky-blue' : 'bg-sky-600'
                            }`}
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 5}s`,
                                animationDuration: `${5 + Math.random() * 10}s`,
                            }}
                        />
                    ))}
                </div>

                {/* Navigation */}
                <nav className={`shadow-lg border-b transition-colors duration-500 ${
                    isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
                }`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleBackToProfile}
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
                                }`}>Practice Mode</h1>
                            </div>
                            <button
                                onClick={toggleDarkMode}
                                className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    isDarkMode 
                                        ? 'bg-sky-blue focus:ring-sky-blue' 
                                        : 'bg-gray-300 focus:ring-sky-600'
                                }`}
                            >
                                <span
                                    className={`inline-block w-6 h-6 transform transition-transform duration-300 ease-in-out rounded-full shadow-lg ${
                                        isDarkMode 
                                            ? 'translate-x-9 bg-gray-900' 
                                            : 'translate-x-1 bg-white'
                                    }`}
                                >
                                    <span className="flex items-center justify-center h-full text-xs">
                                        {isDarkMode ? '🌙' : '☀️'}
                                    </span>
                                </span>
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-4 py-12">
                    <div className="text-center mb-12">
                        <p className={`text-xl transition-colors duration-500 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                            Choose your practice mode to sharpen your interview skills
                        </p>
                    </div>

                        {/* Mode Selection Cards */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Text Mode Card */}
                            <div
                                onClick={() => setSelectedMode('text')}
                                className={`relative group cursor-pointer rounded-2xl p-8 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${
                                    isDarkMode
                                        ? 'bg-gray-800 hover:bg-gray-750'
                                        : 'bg-white hover:bg-gray-50'
                                } shadow-xl border-2 ${
                                    isDarkMode ? 'border-gray-700' : 'border-gray-200'
                                } hover:border-sky-500`}
                            >
                                <div className="text-center">
                                    <div className={`text-6xl mb-4 transition-transform duration-300 group-hover:scale-110`}>
                                        📝
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
                                    <div className={`text-6xl mb-4 transition-transform duration-300 group-hover:scale-110`}>
                                        🎥
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">✨</span>
                                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                                            AI-Powered Feedback
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">📊</span>
                                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                                            Detailed Scoring
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🎯</span>
                                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
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
        <div className={`min-h-screen relative overflow-hidden transition-colors duration-500 ${
            isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
        }`}>
            {/* Animated background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className={`absolute w-1 h-1 rounded-full opacity-10 animate-float ${
                            isDarkMode ? 'bg-sky-blue' : 'bg-sky-600'
                        }`}
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${5 + Math.random() * 10}s`,
                        }}
                    />
                ))}
            </div>

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
                        >
                            <span
                                className={`inline-block w-6 h-6 transform transition-transform duration-300 ease-in-out rounded-full shadow-lg ${
                                    isDarkMode 
                                        ? 'translate-x-9 bg-gray-900' 
                                        : 'translate-x-1 bg-white'
                                }`}
                            >
                                <span className="flex items-center justify-center h-full text-xs">
                                    {isDarkMode ? '🌙' : '☀️'}
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
                                🎲 Random Question
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
                                ➡️ Next Question
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
                                🔄 Practice Weak Areas
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
                            <p className="text-red-500 font-semibold">⚠️ {error}</p>
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
                                ✓ Answer Graded!
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
                                        📝 Feedback:
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
                                        💪 Strengths:
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
                                        🎯 Areas for Improvement:
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
 * Audio-based practice mode with voice recording, transcription, and answer submission
 * Includes placeholder for future facial tracking integration
 */
function AudioPracticeMode({ onBack, isDarkMode, toggleDarkMode }) {
    const [question, setQuestion] = useState("");
    const [answerCriteria, setAnswerCriteria] = useState("");
    const [error, setError] = useState("");
    const [currentQuestionId, setCurrentQuestionId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);
    const [poorlyAnswered, setPoorlyAnswered] = useState([]); // Questions scored < 7
    const [showVideoPlaceholder, setShowVideoPlaceholder] = useState(false);
    
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
            setSubmitResult(null);
            setError("");
        } catch (err) {
            console.error(err);
            setError(err.message);
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
            const result = await fetch(`/api/question/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    questionId: currentQuestionId,
                    question: question,
                    answer: fullTranscript, // Use transcript as answer
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
        <div className={`min-h-screen relative overflow-hidden transition-colors duration-500 ${
            isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
        }`}>
            {/* Animated background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className={`absolute w-1 h-1 rounded-full opacity-10 animate-float ${
                            isDarkMode ? 'bg-sky-blue' : 'bg-sky-600'
                        }`}
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${5 + Math.random() * 10}s`,
                        }}
                    />
                ))}
            </div>

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
                        >
                            <span
                                className={`inline-block w-6 h-6 transform transition-transform duration-300 ease-in-out rounded-full shadow-lg ${
                                    isDarkMode 
                                        ? 'translate-x-9 bg-gray-900' 
                                        : 'translate-x-1 bg-white'
                                }`}
                            >
                                <span className="flex items-center justify-center h-full text-xs">
                                    {isDarkMode ? '🌙' : '☀️'}
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
                            <p className="text-yellow-600 font-semibold">⚠️ Speech recognition not supported in this browser. Please use Chrome or Edge for audio practice.</p>
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
                                🎲 Random Question
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
                                ➡️ Next Question
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
                                🔄 Practice Weak Areas
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
                            <p className="text-red-500 font-semibold">⚠️ {error || audioError}</p>
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
                                    onClick={() => setShowVideoPlaceholder(!showVideoPlaceholder)}
                                    className={`text-sm px-3 py-1 rounded transition-colors ${
                                        isDarkMode
                                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                    {showVideoPlaceholder ? '🎤 Audio Only' : '📹 Show Camera'}
                                </button>
                            </div>

                            {/* Video Placeholder for future facial tracking */}
                            {showVideoPlaceholder && (
                                <div className={`mb-4 rounded-lg overflow-hidden border-2 ${
                                    isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-gray-100'
                                }`}>
                                    <div className="aspect-video flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="text-6xl mb-4">📹</div>
                                            <p className={`text-sm ${
                                                isDarkMode ? 'text-gray-500' : 'text-gray-400'
                                            }`}>
                                                Camera feature coming soon
                                            </p>
                                            <p className={`text-xs mt-2 ${
                                                isDarkMode ? 'text-gray-600' : 'text-gray-500'
                                            }`}>
                                                Facial tracking will be integrated here
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recording Controls */}
                            <div className="flex justify-center items-center gap-4 mb-4">
                                <button
                                    onClick={toggleRecording}
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
                                            🎤 Start Recording
                                        </>
                                    )}
                                </button>
                                
                                {/* Clear/Reset Button */}
                                {(transcript || interimTranscript) && (
                                    <button
                                        onClick={resetWhileRecording}
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
                                        🗑️ Clear
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
                                ✓ Answer Graded!
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
                                        📝 Feedback:
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
                                        💪 Strengths:
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
                                        🎯 Areas for Improvement:
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
