import React, { useState } from "react";

function EditableField({ label, type = "text", value = "", placeholder = "", onSave }) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const save = () => {
    setEditing(false);
    if (onSave) onSave(localValue);
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
            <button onClick={save} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
            <button onClick={() => { setEditing(false); setLocalValue(value); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
          </div>
        </>
      ) : (
        <div className="mt-1 flex items-center justify-between">
          <div className="text-gray-700">{value || <span className="text-gray-400">{placeholder}</span>}</div>
          <button onClick={() => setEditing(true)} className="ml-3 px-2 py-1 bg-blue-600 text-white rounded">Edit</button>
        </div>
      )}
    </div>
  );
}

function Profile({ user }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center p-6">
      <div className="max-w-3xl w-full bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">User stats</h2>
          <div className="space-y-3">
            <div>
              <label className="font-medium"># of questions answered:</label>
              <div className="mt-1 text-gray-600">(not populated)</div>
            </div>

            <div>
              <label className="font-medium">Interview readiness meter:</label>
              <div className="mt-2 w-full bg-gray-200 rounded h-4">
                {/* placeholder empty meter */}
                <div className="h-4 rounded bg-blue-500" style={{ width: `0%` }} />
              </div>
            </div>

            <div>
              <label className="font-medium">Score of each question:</label>
              <ul className="list-disc list-inside text-gray-600 mt-1">
                <li>(no scores yet)</li>
              </ul>
            </div>

            <div>
              <label className="font-medium">Previous answers:</label>
              <div className="mt-1 text-gray-600">(no previous answers)</div>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">User settings</h2>
          <div className="space-y-3">
            <div>
              <EditableField
                label="Change username"
                value={user?.name || ''}
                placeholder="New username"
                onSave={(v) => console.log('Save username:', v)}
              />
            </div>

            <div>
              <EditableField
                label="Change password"
                type="password"
                value={''}
                placeholder="New password"
                onSave={(v) => console.log('Save password:', v)}
              />
            </div>

            <div>
              <label className="block font-medium">Delete account</label>
              <div className="mt-2">
                <button className="px-3 py-1 bg-red-600 text-white rounded">Delete account</button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Resume</h2>
          <div className="flex items-center space-x-3">
            <input type="file" accept="application/pdf" />
            <button className="px-3 py-1 bg-green-600 text-white rounded">Upload resume</button>
          </div>
        </section>

        <div className="mt-6 text-sm text-gray-500">Signed in as: {user?.name || user?.email}</div>
      </div>
    </div>
  );
}

export default Profile;
