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
  const [session, setSession] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfiles();

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setShowSignIn(false);
    });

    const profileChannel = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadProfiles())
      .subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(profileChannel);
    };
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    setLoading(false);
    if (error) alert(error.message);
    else alert('Check your email for the login link.');
  }

  async function signOut() {
    await supabase.auth.signOut();
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
    if (!session) {
      setShowSignIn(true);
      return;
    }
    setEditing(emptyProfile);
  }

  function startEditProfile(profile) {
    if (!session) {
      setShowSignIn(true);
      return;
    }
    if (profile.created_by !== session.user.id) {
      alert('Only the profile creator can edit this profile.');
      return;
    }
    setEditing(profile);
    setSelected(null);
  }

  async function uploadImage(file) {
    if (!file) return null;
    if (!session) throw new Error('Please sign in before uploading an image.');
    const ext = file.name.split('.').pop();
    const filePath = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('profile-images').upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from('profile-images').getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function saveProfile(profile, file) {
    if (!session) {
      setShowSignIn(true);
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
        created_by: session.user.id,
        owner_email: session.user.email
      };

      if (profile.id) {
        const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('profiles').insert(payload);
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
    if (!session || profile.created_by !== session.user.id) {
      alert('Only the profile creator can delete this profile.');
      return;
    }
    if (!confirm('Delete this profile?')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
    if (error) alert(error.message);
    else {
      setSelected(null);
      loadProfiles();
    }
  }

  const filtered = profiles.filter(p => JSON.stringify(p).toLowerCase().includes(query.toLowerCase()));

  return <>
    <header className="topbar">
      <div>
        <h1>Team Manual</h1>
        <p>Browse quick team profiles. Sign in only when you need to create or edit your own profile.</p>
      </div>
      {session ? <button className="secondary" onClick={signOut}><LogOut size={16}/> Sign out</button> : <button className="secondary" onClick={() => setShowSignIn(true)}><User size={16}/> Sign in</button>}
    </header>

    <main className="container">
      <div className="toolbar">
        <div className="search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search profiles..."/></div>
        <button onClick={startCreateProfile}><Plus size={18}/> Add profile</button>
      </div>
      <section className="grid">
        {filtered.map(profile => <article className="profileCard" key={profile.id} onClick={() => setSelected(profile)}><Avatar profile={profile}/><h2>{profile.name}</h2><p><MapPin size={14}/> {profile.location || 'Location not added'}</p></article>)}
      </section>
      {filtered.length === 0 && <p className="empty">No profiles found yet.</p>}
    </main>

    {showSignIn && <SignInModal email={email} setEmail={setEmail} signIn={signIn} loading={loading} onClose={() => setShowSignIn(false)} />}
    {selected && <ProfileModal profile={selected} user={session?.user} onClose={() => setSelected(null)} onEdit={() => startEditProfile(selected)} onDelete={() => deleteProfile(selected)} />}
    {editing && <EditModal profile={editing} onClose={() => setEditing(null)} onSave={saveProfile} loading={loading} />}
  </>;
}

function SignInModal({ email, setEmail, signIn, loading, onClose }) {
  return <div className="overlay"><section className="modal"><button className="close" onClick={onClose}>×</button><h2>Sign in</h2><p className="muted">Sign in with your work email to create or edit your profile. Everyone can still view the team manual without signing in.</p><form onSubmit={signIn}><label className="fieldLabel">Work email<input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" type="email" required/></label><div className="actions"><button disabled={loading}>{loading ? 'Sending...' : 'Send magic link'}</button></div></form></section></div>;
}

function Avatar({ profile }) {
  const initials = (profile.name || 'TM').split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase();
  return <div className="avatar">{profile.image_url ? <img src={profile.image_url} alt=""/> : initials}</div>;
}

function ProfileModal({ profile, user, onClose, onEdit, onDelete }) {
  const canEdit = user && profile.created_by === user.id;
  return <div className="overlay"><section className="modal"><button className="close" onClick={onClose}>×</button><div className="modalTop"><Avatar profile={profile}/><div><h2>{profile.name}</h2><p>{profile.role || 'Team member'}</p></div></div><Info label="Location" value={profile.location}/><Info label="Working hours" value={profile.hours}/><Info label="Best way to communicate" value={profile.communication}/><Info label="Hobbies / interests" value={profile.interests}/>{(profile.custom_fields || []).map((f, i) => <Info key={i} label={f.label} value={f.value}/>) }{profile.owner_email && <p className="owner">Created by {profile.owner_email}</p>}{canEdit && <div className="actions"><button onClick={onEdit}>Edit profile</button><button className="danger" onClick={onDelete}>Delete</button></div>}</section></div>;
}

function Info({ label, value }) {
  return <div className="info"><strong>{label}</strong><span>{value || 'Not added'}</span></div>;
}

function EditModal({ profile, onClose, onSave, loading }) {
  const [form, setForm] = useState(profile);
  const [file, setFile] = useState(null);
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const custom = form.custom_fields || [];
  return <div className="overlay"><form className="modal" onSubmit={e => { e.preventDefault(); onSave(form, file); }}><button type="button" className="close" onClick={onClose}>×</button><h2>{form.id ? 'Edit profile' : 'Add profile'}</h2><div className="two"><Input label="Name" value={form.name} onChange={v => update('name', v)} required/><Input label="Role" value={form.role} onChange={v => update('role', v)}/><Input label="Location" value={form.location} onChange={v => update('location', v)}/><Input label="Working hours" value={form.hours} onChange={v => update('hours', v)}/></div><Textarea label="Best way to communicate" value={form.communication} onChange={v => update('communication', v)}/><Textarea label="Hobbies / interests" value={form.interests} onChange={v => update('interests', v)}/><label className="fieldLabel">Profile picture</label><input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])}/><div className="custom"><strong>Custom fields</strong>{custom.map((f, i) => <div className="customRow" key={i}><input placeholder="Field" value={f.label} onChange={e => { const next=[...custom]; next[i].label=e.target.value; update('custom_fields', next); }}/><input placeholder="Value" value={f.value} onChange={e => { const next=[...custom]; next[i].value=e.target.value; update('custom_fields', next); }}/><button type="button" className="secondary" onClick={() => update('custom_fields', custom.filter((_, idx) => idx !== i))}>Remove</button></div>)}<button type="button" className="secondary" onClick={() => update('custom_fields', [...custom, { label: '', value: '' }])}>Add field</button></div><div className="actions"><button disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</button></div></form></div>;
}

function Input({ label, value, onChange, required }) { return <label className="fieldLabel">{label}<input value={value || ''} onChange={e => onChange(e.target.value)} required={required}/></label>; }
function Textarea({ label, value, onChange }) { return <label className="fieldLabel">{label}<textarea value={value || ''} onChange={e => onChange(e.target.value)}/></label>; }

createRoot(document.getElementById('root')).render(<App />);
