import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabaseClient';
import { Plus, Search, LogOut, MapPin } from 'lucide-react';
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
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadProfiles();
  }, [session]);

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
    setProfiles([]);
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) alert(error.message);
    else setProfiles(data || []);
  }

  async function uploadImage(file) {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const filePath = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('profile-images').upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from('profile-images').getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function saveProfile(profile, file) {
    setLoading(true);
    try {
      const imageUrl = file ? await uploadImage(file) : profile.image_url;
      const payload = {
        ...profile,
        image_url: imageUrl || '',
        owner_id: session.user.id,
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

  async function deleteProfile(id) {
    if (!confirm('Delete this profile?')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) alert(error.message);
    else {
      setSelected(null);
      loadProfiles();
    }
  }

  const filtered = profiles.filter(p => JSON.stringify(p).toLowerCase().includes(query.toLowerCase()));

  if (!session) {
    return <main className="login"><section className="loginCard"><h1>Team Manual</h1><p>Sign in with your work email to view and manage team profiles.</p><form onSubmit={signIn}><input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" type="email" required/><button disabled={loading}>{loading ? 'Sending...' : 'Send magic link'}</button></form></section></main>;
  }

  return <>
    <header className="topbar"><div><h1>Team Manual</h1><p>Quick team profiles with full details one click away.</p></div><button className="secondary" onClick={signOut}><LogOut size={16}/> Sign out</button></header>
    <main className="container">
      <div className="toolbar"><div className="search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search profiles..."/></div><button onClick={() => setEditing(emptyProfile)}><Plus size={18}/> Add profile</button></div>
      <section className="grid">{filtered.map(profile => <article className="profileCard" key={profile.id} onClick={() => setSelected(profile)}><Avatar profile={profile}/><h2>{profile.name}</h2><p><MapPin size={14}/> {profile.location || 'Location not added'}</p></article>)}</section>
    </main>
    {selected && <ProfileModal profile={selected} user={session.user} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onDelete={() => deleteProfile(selected.id)} />}
    {editing && <EditModal profile={editing} onClose={() => setEditing(null)} onSave={saveProfile} loading={loading} />}
  </>;
}

function Avatar({ profile }) {
  const initials = (profile.name || 'TM').split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase();
  return <div className="avatar">{profile.image_url ? <img src={profile.image_url} alt=""/> : initials}</div>;
}

function ProfileModal({ profile, user, onClose, onEdit, onDelete }) {
  const canEdit = profile.owner_id === user.id;
  return <div className="overlay"><section className="modal"><button className="close" onClick={onClose}>×</button><div className="modalTop"><Avatar profile={profile}/><div><h2>{profile.name}</h2><p>{profile.role || 'Team member'}</p></div></div><Info label="Location" value={profile.location}/><Info label="Working hours" value={profile.hours}/><Info label="Best way to communicate" value={profile.communication}/><Info label="Hobbies / interests" value={profile.interests}/>{(profile.custom_fields || []).map((f, i) => <Info key={i} label={f.label} value={f.value}/>) }<p className="owner">Created by {profile.owner_email}</p>{canEdit && <div className="actions"><button onClick={onEdit}>Edit profile</button><button className="danger" onClick={onDelete}>Delete</button></div>}</section></div>;
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
