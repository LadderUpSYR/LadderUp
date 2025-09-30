import { useState } from "react";
import "../App.css";

const API_BASE = "http://localhost:8000";

function QuestionDebug() {
    const [questionId, setQuestionId] = useState("");
    const [question, setQuestion] = useState("");
    const [error, setError] = useState("");

    function isValidQuestionId(input) {
        const num = parseInt(input, 10);
        return !Number.isNaN(num) && Number.isInteger(num) && num > 0;
    }

    const getQuestionOnId = async ({ questionId }) => {
        try {
            const result = await fetch(`${API_BASE}/api/question/id`, {
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
            return data;
        } catch (err) {
            throw err;
        }
    };

    const getRandomQuestion = async () => {
        try {
            const result = await fetch(`${API_BASE}/api/question/random`, {
                method: "GET",
                credentials: "include",
            });

            if (!result.ok) throw new Error("Failed to fetch random question");

            const data = await result.json();
            setQuestion(data.question);
        } catch (err) {
            console.error(err);
            setError(err.message);
        }
    };

    return (
        <div className="flex flex-col items-center p-8 gap-4">
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
                className="bg-blue-300 p-2"
                onClick={getRandomQuestion}
            >
                Get Random Question
            </button>

            <div className="bg-gray-200 p-4 w-full max-w-md">
                {error && <p className="text-red-500">{error}</p>}
                {question && <p>{question}</p>}
                {!question && !error && <p>Nothing yet</p>}
            </div>
        </div>
    );
}

export default QuestionDebug;
