import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabaseClient';
import { Plus, Search, LogOut, MapPin, User } from 'lucide-react';
import './styles.css';

const emptyProfile = {
  name: '',
  role: '',
  location: '',
  hours: '',
  communication: '',
  interests: '',
  image_url: '',
  custom_fields: []
};

function App() {
  const [isAdmin, setIsAdmin] = useState(
    localStorage.getItem('teamManualAdmin') === 'true'
  );
  const [profiles, setProfiles] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfiles();

    const profileChannel = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadProfiles())
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, []);

  function enterAdminMode() {
    const password = prompt('Enter team password');

    if (password === import.meta.env.VITE_TEAM_ADMIN_PASSWORD) {
      localStorage.setItem('teamManualAdmin', 'true');
      setIsAdmin(true);
    } else {
      alert('Incorrect password');
    }
  }

  function exitAdminMode() {
    localStorage.removeItem('teamManualAdmin');
    setIsAdmin(false);
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error(error.message);
    else setProfiles(data || []);
  }

  function startCreateProfile() {
    if (!isAdmin) {
      enterAdminMode();
      return;
    }

    setEditing(emptyProfile);
  }

  function startEditProfile(profile) {
    if (!isAdmin) {
      enterAdminMode();
      return;
    }

    setEditing(profile);
    setSelected(null);
  }

  async function uploadImage(file) {
    if (!file) return null;

    const ext = file.name.split('.').pop();
    const filePath = `team-manual/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function saveProfile(profile, file) {
    if (!isAdmin) {
      enterAdminMode();
      return;
    }

    setLoading(true);

    try {
      const imageUrl = file ? await uploadImage(file) : profile.image_url;

      const payload = {
        name: profile.name,
        role: profile.role,
        location: profile.location,
        hours: profile.hours,
        communication: profile.communication,
        interests: profile.interests,
        image_url: imageUrl || '',
        custom_fields: profile.custom_fields || [],
        owner_email: 'Team admin'
      };

      if (profile.id) {
        const { error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', profile.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert(payload);

        if (error) throw error;
      }

      setEditing(null);
      await loadProfiles();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteProfile(profile) {
    if (!isAdmin) {
      enterAdminMode();
      return;
    }

    if (!confirm('Delete this profile?')) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profile.id);

    if (error) alert(error.message);
    else {
      setSelected(null);
      loadProfiles();
    }
  }

  const filtered = profiles.filter(profile =>
    JSON.stringify(profile).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Team Manual</h1>
          <p>Browse quick team profiles. Admin mode is only needed to add or edit profiles.</p>
        </div>

        {isAdmin ? (
          <button className="secondary" onClick={exitAdminMode}>
            <LogOut size={16} /> Exit admin mode
          </button>
        ) : (
          <button className="secondary" onClick={enterAdminMode}>
            <User size={16} /> Admin mode
          </button>
        )}
      </header>

      <main className="container">
        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search profiles..."
            />
          </div>

          {isAdmin && (
            <button onClick={startCreateProfile}>
              <Plus size={18} /> Add profile
            </button>
          )}
        </div>

        <section className="grid">
          {filtered.map(profile => (
            <article
              className="profileCard"
              key={profile.id}
              onClick={() => setSelected(profile)}
            >
              <Avatar profile={profile} />
              <h2>{profile.name}</h2>
              <p>
                <MapPin size={14} /> {profile.location || 'Location not added'}
              </p>
            </article>
          ))}
        </section>

        {filtered.length === 0 && (
          <p className="empty">No profiles found yet.</p>
        )}
      </main>

      {selected && (
        <ProfileModal
          profile={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onEdit={() => startEditProfile(selected)}
          onDelete={() => deleteProfile(selected)}
        />
      )}

      {editing && (
        <EditModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSave={saveProfile}
          loading={loading}
        />
      )}
    </>
  );
}

function Avatar({ profile }) {
  const initials = (profile.name || 'TM')
    .split(' ')
    .map(x => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="avatar">
      {profile.image_url ? <img src={profile.image_url} alt="" /> : initials}
    </div>
  );
}

function ProfileModal({ profile, isAdmin, onClose, onEdit, onDelete }) {
  return (
    <div className="overlay">
      <section className="modal">
        <button className="close" onClick={onClose}>×</button>

        <div className="modalTop">
          <Avatar profile={profile} />
          <div>
            <h2>{profile.name}</h2>
            <p>{profile.role || 'Team member'}</p>
          </div>
        </div>

        <Info label="Location" value={profile.location} />
        <Info label="Working hours" value={profile.hours} />
        <Info label="Best way to communicate" value={profile.communication} />
        <Info label="Hobbies / interests" value={profile.interests} />

        {(profile.custom_fields || []).map((field, index) => (
          <Info key={index} label={field.label} value={field.value} />
        ))}

        {isAdmin && (
          <div className="actions">
            <button onClick={onEdit}>Edit profile</button>
            <button className="danger" onClick={onDelete}>Delete</button>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="info">
      <strong>{label}</strong>
      <span>{value || 'Not added'}</span>
    </div>
  );
}

function EditModal({ profile, onClose, onSave, loading }) {
  const [form, setForm] = useState(profile);
  const [file, setFile] = useState(null);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const custom = form.custom_fields || [];

  return (
    <div className="overlay">
      <form
        className="modal"
        onSubmit={e => {
          e.preventDefault();
          onSave(form, file);
        }}
      >
        <button type="button" className="close" onClick={onClose}>×</button>

        <h2>{form.id ? 'Edit profile' : 'Add profile'}</h2>

        <div className="two">
          <Input
            label="Name"
            value={form.name}
            onChange={value => update('name', value)}
            required
          />

          <Input
            label="Role"
            value={form.role}
            onChange={value => update('role', value)}
          />

          <Input
            label="Location"
            value={form.location}
            onChange={value => update('location', value)}
          />

          <Input
            label="Working hours"
            value={form.hours}
            onChange={value => update('hours', value)}
          />
        </div>

        <Textarea
          label="Best way to communicate"
          value={form.communication}
          onChange={value => update('communication', value)}
        />

        <Textarea
          label="Hobbies / interests"
          value={form.interests}
          onChange={value => update('interests', value)}
        />

        <label className="fieldLabel">Profile picture</label>
        <input
          type="file"
          accept="image/*"
          onChange={e => setFile(e.target.files[0])}
        />

        <div className="custom">
          <strong>Custom fields</strong>

          {custom.map((field, index) => (
            <div className="customRow" key={index}>
              <input
                placeholder="Field"
                value={field.label}
                onChange={e => {
                  const next = [...custom];
                  next[index].label = e.target.value;
                  update('custom_fields', next);
                }}
              />

              <input
                placeholder="Value"
                value={field.value}
                onChange={e => {
                  const next = [...custom];
                  next[index].value = e.target.value;
                  update('custom_fields', next);
                }}
              />

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  update(
                    'custom_fields',
                    custom.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}

          <button
            type="button"
            className="secondary"
            onClick={() =>
              update('custom_fields', [...custom, { label: '', value: '' }])
            }
          >
            Add field
          </button>
        </div>

        <div className="actions">
          <button disabled={loading}>
            {loading ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, required }) {
  return (
    <label className="fieldLabel">
      {label}
      <input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        required={required}
      />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="fieldLabel">
      {label}
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}

createRoot(document.getElementById('root')).render(<App />);
