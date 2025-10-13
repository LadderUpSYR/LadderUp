import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

function EditableField({ label, type = "text", value = "", placeholder = "", onSave, fieldType = "name" }) {
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
    <div>
      <label className="block font-medium">{label}</label>
      {editing ? (
        <>
          <input
            className="mt-1 border rounded px-2 py-1 w-full"
            type={type}
            value={localValue}
            placeholder={placeholder}
            onChange={(e) => setLocalValue(e.target.value)}
          />
          <div className="mt-2 space-x-2">
            <button onClick={save} className="px-3 py-1 bg-blue-600 text-white rounded">
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setLocalValue(value);
              }}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="mt-1 flex items-center justify-between">
          <div className="text-gray-700">
            {value || <span className="text-gray-400">{placeholder}</span>}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="ml-3 px-2 py-1 bg-blue-600 text-white rounded"
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
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeUrl, setResumeUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Fetch existing resume on component mount
  useEffect(() => {
    fetchResume();
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
      window.location.href = "/";
    } catch (error) {
      console.error("Delete account error:", error);
      alert(error.message);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-gray-100 p-6">
      <div className="flex-1 bg-white shadow-md rounded-lg p-6 mr-6">
        <h1 className="text-2xl font-bold mb-4">User Stats</h1>

        <div className="mb-6">
          <label className="font-medium">Interview readiness meter:</label>
          <div className="mt-2 w-full bg-gray-200 rounded h-4">
            <div className="h-4 rounded bg-blue-500" style={{ width: `0%` }} />
          </div>
        </div>

        <div className="mb-6">
          <label className="font-medium"># of questions answered:</label>
          <div className="mt-1 text-gray-600">(not populated)</div>
        </div>

        <div className="mb-6">
          <label className="font-medium">Score of each question:</label>
          <ul className="list-disc list-inside text-gray-600 mt-1">
            <li>(no scores yet)</li>
          </ul>
        </div>

        <div>
          <label className="font-medium">Previous answers:</label>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-2 border-b">Date</th>
                  <th className="px-8 py-2 border-b">Question</th>
                  <th className="px-2 py-2 border-b">Answer</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2 border-b text-gray-400" colSpan={4}>
                    (no previous answers)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="w-96 bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">User Settings</h2>
        <div className="space-y-6">
          <EditableField
            label="Change username"
            value={user?.name || ""}
            placeholder="New username"
            fieldType="name"
            onSave={(v) => console.log("Save username:", v)}
          />

          <EditableField
            label="Change password"
            type="password"
            value={""}
            placeholder="New password"
            fieldType="password"
            onSave={(v) => console.log("Save password:", v)}
          />

          <div>
            <label className="block font-medium">Delete account</label>
            <div className="mt-2">
              <button
                onClick={deleteAccount}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                Delete account
              </button>
            </div>
          </div>

          <div>
            <h3 className="block font-medium mb-2">Resume</h3>
            <p className="text-sm text-gray-500 mb-3">Only PDF documents will be accepted</p>
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
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700"
                >
                  {resumeUrl ? "Change Resume" : "Upload Resume"}
                </label>
              )}
              
              {resumeFile && (
                <>
                  <p className="text-sm text-gray-600">Selected: {resumeFile.name}</p>
                  <button
                    onClick={handleUploadResume}
                    disabled={uploading}
                    className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {uploading ? "Uploading..." : "Confirm Upload"}
                  </button>
                </>
              )}
              
              {resumeUrl && !resumeFile && (
                <div className="mt-3">
                  <p className="text-sm text-green-600 mb-2">✓ Current resume: resume.pdf</p>
                  <a
                    href={resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Download/View Resume
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          Signed in as: {user?.name || user?.email}
        </div>
      </div>
    </div>
  );
}

export default Profile;
