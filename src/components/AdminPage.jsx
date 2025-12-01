import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import EditableField from "./ProfilePage";

function AdminPage() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flaggedReasons, setFlaggedReasons] = useState({}); // { uid: reason }
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeUrl, setResumeUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchResume();
  }, []);

  const fetchResume = async () => {
    try {
      const response = await fetch("/api/profile/resume", {
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

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = (userId) => {
    alert(`Ban functionality not yet implemented for user ${userId}`);
  };

  const handleFlagUser = (userId) => {
    const reason = window.prompt("Enter a reason to flag this user:");
    if (reason && reason.trim().length > 0) {
      setFlaggedReasons((prev) => ({ ...prev, [userId]: reason.trim() }));
    }
  };

  if (loading) return (
    <div className="min-h-screen w-full grid place-items-center bg-gray-100">
      <p className="text-gray-500">Loading users...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen w-full grid place-items-center bg-gray-100">
      <div className="bg-red-50 text-red-600 rounded-lg p-4">
        Error: {error}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gray-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-md rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="text-sm text-gray-500">Total Users: {users.length}</div>
            <button
              onClick={() => {
                try {
                  window.history.pushState({}, '', '/profile');
                  window.location.reload();
                } catch (e) {
                  window.location.pathname = '/profile';
                }
              }}
              className="px-3 py-1 bg-gray-200 text-slate-900 rounded hover:bg-gray-300 text-sm whitespace-nowrap"
            >
              Back to Profile
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="hidden md:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flagged Reason
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-3 sm:px-6 py-4 text-center text-gray-500 text-sm">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4">
                      <div className="text-xs sm:text-sm font-medium text-gray-900 flex items-center gap-2">
                        <span className="truncate max-w-[100px] sm:max-w-none">{user.name || "No name"}</span>
                        {flaggedReasons[user.uid] && (
                          <span className="font-bold text-red-600 text-lg flex-shrink-0" title="Flagged">!</span>
                        )}
                      </div>
                      {/* Show email on mobile below name */}
                      <div className="sm:hidden text-xs text-gray-500 truncate mt-1">
                        {user.email}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 sm:px-6 py-4">
                      <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[200px]">
                        {user.email}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-6 py-4">
                      <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[200px]">
                        {flaggedReasons[user.uid] ? flaggedReasons[user.uid] : <span className="text-gray-400">Not Flagged.</span>}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right text-xs sm:text-sm font-medium">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleFlagUser(user.uid)}
                          className="text-yellow-700 hover:text-yellow-900 bg-yellow-50 px-2 sm:px-3 py-1 rounded-md text-xs whitespace-nowrap"
                        >
                          Flag
                        </button>
                        <button
                          onClick={() => handleBanUser(user.uid)}
                          className="text-red-600 hover:text-red-900 bg-red-50 px-2 sm:px-3 py-1 rounded-md text-xs whitespace-nowrap"
                        >
                          Ban
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;