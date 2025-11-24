import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useDarkMode } from "../utils/useDarkMode";

function EditableField({ label, type = "text", value = "", placeholder = "", onSave, fieldType = "name", isDarkMode }) {
  const { setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const save = async () => {
    try {
      let endpoint, body, errorMsg;
      
      if (fieldType === "password") {
        // Password change endpoint
        if (localValue.length < 6) {
          alert("Password must be at least 6 characters");
          return;
        }
        endpoint = "http://localhost:8000/api/profile/change-password";
        body = JSON.stringify({ password: localValue });
        errorMsg = "Failed to update password";
      } else {
        // Username change endpoint
        if (localValue.trim().length < 2) {
          alert("Name must be at least 2 characters");
          return;
        }
        endpoint = "http://localhost:8000/api/profile/edit";
        body = JSON.stringify({ name: localValue });
        errorMsg = "Failed to update username";
      }

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || errorMsg);
      }

      const data = await response.json();
      
      // Update user context if username was changed
      if (fieldType === "name" && data.user) {
        setUser(data.user);
      }
      
      alert(data.msg || "Update successful");
      setEditing(false);
      setLocalValue(fieldType === "password" ? "" : localValue); // Clear password field after save
    } catch (error) {
      console.error("Update error:", error);
      alert(error.message);
    }
  };

  return (
    <div className="mb-6">
      <label className={`block font-medium transition-colors duration-500 ${
        isDarkMode ? 'text-gray-300' : 'text-gray-700'
      }`}>{label}</label>
      {editing ? (
        <>
          <input
            className={`mt-1 border rounded-lg px-3 py-2 w-full transition-colors duration-500 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600 text-white focus:border-sky-blue' 
                : 'bg-white border-gray-300 text-gray-900 focus:border-sky-600'
            } focus:outline-none focus:ring-2 focus:ring-opacity-50`}
            type={type}
            value={localValue}
            placeholder={placeholder}
            onChange={(e) => setLocalValue(e.target.value)}
          />
          <div className="mt-2 space-x-2">
            <button 
              onClick={save} 
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                isDarkMode
                  ? 'bg-sky-blue text-black hover:bg-sky-400 shadow-sky-blue/50'
                  : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/30'
              }`}
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setLocalValue(value);
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="mt-1 flex items-center justify-between">
          <div className={`transition-colors duration-500 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {value || <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>{placeholder}</span>}
          </div>
          <button
            onClick={() => setEditing(true)}
            className={`ml-3 px-4 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
              isDarkMode
                ? 'bg-sky-blue text-black hover:bg-sky-400 shadow-sky-blue/50'
                : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/30'
            }`}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

// add props for user and question data
function Profile({ user }) {
  const { logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeUrl, setResumeUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [averageScore, setAverageScore] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch existing resume and answered questions on component mount
  useEffect(() => {
    fetchResume();
    fetchAnsweredQuestions();
  }, []);

  const fetchResume = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/profile/resume", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setResumeUrl(data.resume_url);
      }
    } catch (error) {
      console.error("Error fetching resume:", error);
    }
  };

  const fetchAnsweredQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8000/api/profile/answered-questions", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAnsweredQuestions(data.answered_questions || []);
        setTotalAnswered(data.total_answered || 0);
        setAverageScore(data.average_score || 0);
      }
    } catch (error) {
      console.error("Error fetching answered questions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setResumeFile(file);
    } else {
      alert("Please select a PDF file");
      e.target.value = null;
    }
  };

  const handleUploadResume = async () => {
    if (!resumeFile) {
      alert("Please select a file first");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", resumeFile);

      const response = await fetch("http://localhost:8000/api/profile/upload-resume", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to upload resume");
      }

      const data = await response.json();
      setResumeUrl(data.resume_url);
      setResumeFile(null);
      alert("Resume uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };
  
  const deleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/api/auth/delete-account", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to delete account");
      }

      // Call logout to clear the session and update context
      await logout();
      
      // Show success message after logout completes
      alert("Account deleted successfully");
      
      // Redirect to login page
      navigate('/');
    } catch (error) {
      console.error("Delete account error:", error);
      alert(error.message);
    }
  };

  return (
    <div className={`min-h-screen w-full relative transition-colors duration-500 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>

      {/* Navigation */}
      <nav className={`shadow-lg border-b transition-colors duration-500 ${
        isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className={`text-xl sm:text-2xl font-bold transition-colors duration-500 ${
              isDarkMode ? 'text-sky-blue' : 'text-sky-600'
            }`}>LadderUp Profile</h1>
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
      <div className="relative z-10 flex flex-col lg:flex-row max-w-7xl mx-auto p-4 sm:p-6 gap-4 sm:gap-6">
        {/* Left Panel - User Stats */}
        <div className={`flex-1 rounded-xl shadow-2xl border p-4 sm:p-6 transition-colors duration-500 ${
          isDarkMode 
            ? 'bg-gradient-to-br from-gray-800 to-black border-gray-700' 
            : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
        }`}>
          <h2 className={`text-xl sm:text-2xl font-bold mb-6 transition-colors duration-500 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>User Stats</h2>

          <div className="mb-8">
            <label className={`font-semibold text-lg mb-3 block transition-colors duration-500 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Interview Readiness Meter</label>
            <div className={`w-full rounded-full h-6 overflow-hidden transition-colors duration-500 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}>
              <div 
                className="h-6 rounded-full bg-gradient-to-r from-sky-blue to-blue-500 transition-all duration-500 flex items-center justify-end pr-3"
                style={{ width: `${Math.min(averageScore * 10, 100)}%` }} 
              >
                <span className="text-xs font-bold text-white">
                  {averageScore.toFixed(1)}/10
                </span>
              </div>
            </div>
            <div className={`text-sm mt-2 transition-colors duration-500 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Average Score: {averageScore.toFixed(1)} / 10
            </div>
          </div>

          <div className="mb-8">
            <label className={`font-semibold text-lg mb-2 block transition-colors duration-500 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}># of Questions Answered</label>
            <div className={`text-3xl font-bold transition-colors duration-500 ${
              isDarkMode ? 'text-sky-blue' : 'text-sky-600'
            }`}>{totalAnswered}</div>
          </div>

          <div>
            <label className={`font-semibold text-lg mb-4 block transition-colors duration-500 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Previous Answers</label>
            <div className="overflow-x-auto rounded-lg">
              <table className={`min-w-full text-left border transition-colors duration-500 ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <thead className={`transition-colors duration-500 ${
                  isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                }`}>
                  <tr>
                    <th className={`px-2 sm:px-4 py-3 border-b font-semibold text-xs sm:text-sm transition-colors duration-500 ${
                      isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
                    }`}>Date</th>
                    <th className={`px-2 sm:px-4 py-3 border-b font-semibold text-xs sm:text-sm transition-colors duration-500 ${
                      isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
                    }`}>Question</th>
                    <th className={`hidden md:table-cell px-2 sm:px-4 py-3 border-b font-semibold text-xs sm:text-sm transition-colors duration-500 ${
                      isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
                    }`}>Answer</th>
                    <th className={`px-2 sm:px-4 py-3 border-b font-semibold text-xs sm:text-sm transition-colors duration-500 ${
                      isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
                    }`}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className={`px-2 sm:px-4 py-3 border-b transition-colors duration-500 ${
                        isDarkMode ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'
                      }`} colSpan={4}>
                        Loading...
                      </td>
                    </tr>
                  ) : answeredQuestions.length > 0 ? (
                    answeredQuestions.map((q, idx) => (
                      <tr key={idx} className={`transition-colors duration-300 ${
                        isDarkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                      }`}>
                        <td className={`px-2 sm:px-4 py-3 border-b text-xs sm:text-sm transition-colors duration-500 ${
                          isDarkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-700'
                        }`}>
                          {new Date(q.date).toLocaleDateString()}
                        </td>
                        <td className={`px-2 sm:px-4 py-3 border-b text-xs sm:text-sm max-w-[150px] sm:max-w-xs truncate transition-colors duration-500 ${
                          isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-900'
                        }`}>
                          {q.question}
                        </td>
                        <td className={`hidden md:table-cell px-2 sm:px-4 py-3 border-b text-xs sm:text-sm max-w-xs truncate transition-colors duration-500 ${
                          isDarkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-700'
                        }`}>
                          {q.answer}
                        </td>
                        <td className={`px-2 sm:px-4 py-3 border-b text-xs sm:text-sm font-bold transition-colors duration-500 ${
                          isDarkMode ? 'border-gray-700 text-sky-blue' : 'border-gray-200 text-sky-600'
                        }`}>
                          {q.score}/10
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className={`px-2 sm:px-4 py-3 border-b transition-colors duration-500 ${
                        isDarkMode ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'
                      }`} colSpan={4}>
                        (no previous answers)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Panel - User Settings */}
        <div className={`w-full lg:w-96 rounded-xl shadow-2xl border p-4 sm:p-6 transition-colors duration-500 ${
          isDarkMode 
            ? 'bg-gradient-to-br from-gray-800 to-black border-gray-700' 
            : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
        }`}>
          <h2 className={`text-lg sm:text-xl font-bold mb-6 transition-colors duration-500 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>User Settings</h2>
          
          <div className="space-y-6">
            <EditableField
              label="Change username"
              value={user?.name || ""}
              placeholder="New username"
              fieldType="name"
              isDarkMode={isDarkMode}
              onSave={(v) => console.log("Save username:", v)}
            />

            <EditableField
              label="Change password"
              type="password"
              value={""}
              placeholder="New password"
              fieldType="password"
              isDarkMode={isDarkMode}
              onSave={(v) => console.log("Save password:", v)}
            />

            <div>
              <label className={`block font-medium mb-3 transition-colors duration-500 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Delete account</label>
              <button
                onClick={deleteAccount}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-600/30"
              >
                Delete account
              </button>
            </div>

            <div>
              <h3 className={`block font-medium mb-3 transition-colors duration-500 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Resume</h3>
              <p className={`text-sm mb-4 transition-colors duration-500 ${
                isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}>Only PDF documents will be accepted</p>
              <div className="space-y-3">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  id="resume-upload"
                  className="hidden"
                />
                
                {!resumeFile && (
                  <label
                    htmlFor="resume-upload"
                    className={`inline-block px-4 py-2 rounded-lg cursor-pointer font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                      isDarkMode
                        ? 'bg-sky-blue text-black hover:bg-sky-400 shadow-sky-blue/50'
                        : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-600/30'
                    }`}
                  >
                    {resumeUrl ? "Change Resume" : "Upload Resume"}
                  </label>
                )}
                
                {resumeFile && (
                  <>
                    <p className={`text-sm transition-colors duration-500 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Selected: {resumeFile.name}</p>
                    <button
                      onClick={handleUploadResume}
                      disabled={uploading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-600/30"
                    >
                      {uploading ? "Uploading..." : "Confirm Upload"}
                    </button>
                  </>
                )}
                
                {resumeUrl && !resumeFile && (
                  <div className="mt-3">
                    <p className="text-sm text-green-600 mb-2 font-semibold">Current resume: resume.pdf</p>
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm font-semibold transition-colors duration-300 ${
                        isDarkMode ? 'text-sky-blue hover:text-sky-400' : 'text-sky-600 hover:text-sky-700'
                      }`}
                    >
                      Download/View Resume →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={`mt-6 text-sm transition-colors duration-500 ${
            isDarkMode ? 'text-gray-500' : 'text-gray-500'
          }`}>
            Signed in as: {user?.name || user?.email}
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => navigate('/practice')}
              className={`w-full px-4 py-3 font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg ${
                isDarkMode
                  ? 'bg-gradient-to-r from-purple-500 to-pink-400 text-black hover:shadow-purple-500/50'
                  : 'bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:shadow-purple-600/40'
              }`}
            >
              Practice Mode
            </button>

            <button
              onClick={() => navigate('/matchmaking')}
              className={`w-full px-4 py-3 font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg ${
                isDarkMode
                  ? 'bg-gradient-to-r from-sky-blue to-blue-400 text-black hover:shadow-sky-blue/50'
                  : 'bg-gradient-to-r from-sky-600 to-blue-500 text-white hover:shadow-sky-600/40'
              }`}
            >
              Start Matchmaking
            </button>
            
            {user?.is_admin && (
              <button
                onClick={() => navigate('/admin')}
                className="w-full px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-600/30"
              >
                Admin Dashboard
              </button>
            )}

            <button
              onClick={() => {
                const ok = window.confirm("Are you sure you want to sign out?");
                if (!ok) return;
                logout();
                navigate('/');
              }}
              className={`w-full px-4 py-3 font-semibold rounded-lg transition-all duration-300 ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-slate-900 hover:bg-gray-300'
              }`}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
