import { useState } from "react";
import "../App.css";


function QuestionDebug() {
    const [questionId, setQuestionId] = useState("");
    const [question, setQuestion] = useState("");
    const [answerCriteria, setAnswerCriteria] = useState("");
    const [error, setError] = useState("");
    const [answer, setAnswer] = useState("");
    const [currentQuestionId, setCurrentQuestionId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);

    const handleBackToProfile = () => {
        try {
            window.history.pushState({}, '', '/profile');
            window.location.reload();
        } catch (e) {
            window.location.pathname = '/profile';
        }
    };

    function isValidQuestionId(input) {
        const num = parseInt(input, 10);
        return !Number.isNaN(num) && Number.isInteger(num) && num > 0;
    }

    const getQuestionOnId = async ({ questionId }) => {
        try {
            const result = await fetch(`/api/question/id`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ questionId }),
            });

            if (!result.ok) {
                let err = {};
                try { err = await result.json(); } catch(e) {}
                throw new Error(err.detail || "Question Grab Failed");
            }

            const data = await result.json();
            setCurrentQuestionId(questionId.toString());
            setAnswerCriteria(data.answerCriteria || "");
            return data;
        } catch (err) {
            throw err;
        }
    };

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
            setSubmitResult({
                success: true,
                score: data.grading?.score || data.answer_record?.score || 0,
                feedback: data.grading?.feedback || "Answer graded successfully",
                strengths: data.grading?.strengths || [],
                improvements: data.grading?.improvements || [],
                message: data.msg,
                totalAnswered: data.total_answered
            });
            
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

    return (
        <div className="flex flex-col items-center p-8 gap-4">
            <div className="w-full max-w-md flex justify-start mb-4">
                <button
                    onClick={handleBackToProfile}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-2"
                >
                    ← Back to Profile
                </button>
            </div>

            <h1 className="text-2xl font-bold mb-4">Question Debug</h1>

            <div>
                <input
                    type="number"
                    placeholder="Enter Question ID"
                    value={questionId}
                    onChange={(e) => setQuestionId(e.target.value)}
                    className="border p-2 mr-2"
                />
                <button
                    className="bg-green-300 p-2"
                    onClick={async () => {
                        setError("");
                        if (!isValidQuestionId(questionId)) {
                            setError("Invalid question ID");
                            return;
                        }
                        try {
                            const data = await getQuestionOnId({ questionId: parseInt(questionId, 10) });
                            setQuestion(data.question);
                            setAnswer("");
                            setSubmitResult(null);
                        } catch (err) {
                            console.error(err);
                            setError(err.message);
                        }
                    }}
                >
                    Get Question
                </button>
            </div>

            <button
                className="bg-blue-300 p-2 rounded hover:bg-blue-400"
                onClick={getRandomQuestion}
            >
                Get Random Question
            </button>

            <div className="bg-gray-200 p-4 w-full max-w-md rounded">
                <h3 className="font-semibold mb-2">Question:</h3>
                {error && <p className="text-red-500">{error}</p>}
                {question && <p className="mb-4">{question}</p>}
                {!question && !error && <p className="text-gray-500">Nothing yet</p>}
            </div>

            {question && (
                <div className="w-full max-w-md">
                    <div className="mb-4">
                        <label className="block font-semibold mb-2">Your Answer:</label>
                        <textarea
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Type your answer here..."
                            className="w-full border rounded p-3 min-h-[120px]"
                            disabled={submitting}
                        />
                    </div>

                    <button
                        onClick={submitAnswer}
                        disabled={submitting || !answer.trim()}
                        className="w-full px-4 py-3 bg-green-600 text-white font-semibold rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Submitting..." : "Submit Answer"}
                    </button>

                    {submitResult && submitResult.success && (
                        <div className="mt-4 p-6 bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-400 rounded-lg shadow-lg">
                            <h4 className="font-bold text-2xl text-green-800 mb-3">✓ Answer Graded!</h4>
                            
                            <div className="mb-4 p-3 bg-white rounded-lg shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-lg font-semibold text-gray-700">Your Score:</span>
                                    <span className="text-3xl font-bold text-green-600">
                                        {submitResult.score.toFixed(1)}/10
                                    </span>
                                </div>
                            </div>

                            {submitResult.feedback && (
                                <div className="mb-4 p-3 bg-white rounded-lg shadow-sm">
                                    <h5 className="font-semibold text-gray-700 mb-2">📝 Feedback:</h5>
                                    <p className="text-gray-600 text-sm leading-relaxed">{submitResult.feedback}</p>
                                </div>
                            )}

                            {submitResult.strengths && submitResult.strengths.length > 0 && (
                                <div className="mb-4 p-3 bg-white rounded-lg shadow-sm">
                                    <h5 className="font-semibold text-green-700 mb-2">💪 Strengths:</h5>
                                    <ul className="list-disc list-inside space-y-1">
                                        {submitResult.strengths.map((strength, idx) => (
                                            <li key={idx} className="text-green-600 text-sm">{strength}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {submitResult.improvements && submitResult.improvements.length > 0 && (
                                <div className="mb-4 p-3 bg-white rounded-lg shadow-sm">
                                    <h5 className="font-semibold text-blue-700 mb-2">🎯 Areas for Improvement:</h5>
                                    <ul className="list-disc list-inside space-y-1">
                                        {submitResult.improvements.map((improvement, idx) => (
                                            <li key={idx} className="text-blue-600 text-sm">{improvement}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="mt-4 pt-3 border-t border-gray-300">
                                <p className="text-gray-600 text-sm">
                                    Total questions answered: <span className="font-semibold">{submitResult.totalAnswered}</span>
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Graded by AI • Check your profile to see all answered questions
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default QuestionDebug;
