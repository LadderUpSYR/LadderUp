import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";


function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flaggedReasons, setFlaggedReasons] = useState({}); // { uid: reason }

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/admin/users", {
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
    <div className="min-h-screen w-full bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="text-sm text-gray-500">
            Total Users: {users.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flagged Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        {user.name || "No name"}
                        {flaggedReasons[user.uid] && (
                          <span className="font-bold text-red-600 text-lg" title="Flagged">!</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {flaggedReasons[user.uid] ? flaggedReasons[user.uid] : <span className="text-gray-400">Not Flagged.</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2">
                      <button
                        onClick={() => handleFlagUser(user.uid)}
                        className="text-yellow-700 hover:text-yellow-900 bg-yellow-50 px-3 py-1 rounded-md"
                      >
                        Flag User
                      </button>
                      <button
                        onClick={() => handleBanUser(user.uid)}
                        className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded-md"
                      >
                        Ban User
                      </button>
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