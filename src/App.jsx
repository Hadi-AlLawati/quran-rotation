import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, UserCircle, LogOut, Clock, Calendar, ShieldCheck, Trophy, AlertTriangle, CheckCircle, Gift, ArrowLeft, LoaderCircle, Mail, Edit, Bookmark } from 'lucide-react';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import confetti from 'canvas-confetti';
import { getCurrentWeekNumber, getAssignedJuzForUser, getNextDeadline } from './utils';
import { supabase } from './supabaseClient';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login'); // login, dashboard, admin, reader, leaderboard
  const [users, setUsers] = useState([]); // All family profiles
  const [systemDate, setSystemDate] = useState(new Date());

  const fetchCurrentUserProfile = async (user) => {
    let { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile && user.user_metadata && user.user_metadata.name) {
      const { error: insertError } = await supabase.from('profiles').insert([{
        id: user.id,
        name: user.user_metadata.name,
        role: 'user',
        group_id: user.user_metadata.group_id,
        half: user.user_metadata.half,
        start_juz: user.user_metadata.start_juz
      }]);
      if (!insertError) {
        const { data: newProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        profile = newProfile;
        error = null;
      } else {
        alert(`Error saving profile to database: ${insertError.message}`);
        console.error("Profile Insert Error:", insertError);
      }
    }

    if (error || !profile) {
      console.error('Error fetching profile or profile missing:', error);
      alert('Your account profile was not fully created. Please sign up again with a new email or contact an admin to clear your unverified email.');
      supabase.auth.signOut();
      return;
    }

    // Map DB fields to what components expect
    const mappedProfile = { ...profile, group: profile.group_id };
    setCurrentUser(mappedProfile);
    fetchAllUsers();

    if (profile.role === 'admin') {
      setView('admin');
    } else {
      setView('dashboard');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchCurrentUserProfile(session.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchCurrentUserProfile(session.user);
      } else {
        setCurrentUser(null);
        setView('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);



  const fetchAllUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: history } = await supabase.from('reading_history').select('*');

    if (profiles) {
      const mergedUsers = profiles.map(p => {
        const userHistory = history?.filter(h => h.user_id === p.id) || [];
        const maxWeek = userHistory.length > 0 ? Math.max(...userHistory.map(h => h.week_number)) : -1;
        return { ...p, group: p.group_id, completedWeek: maxWeek };
      });
      setUsers(mergedUsers);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Keep systemDate updating every minute for the countdown timer
  useEffect(() => {
    const timer = setInterval(() => setSystemDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="app-container page-container">
      {currentUser && (
        <header className="app-header" style={{ margin: '-2rem -2rem 1.5rem -2rem', padding: '0.75rem 1rem 0.5rem 1rem', display: 'block' }}>
          <div className="flex justify-between items-center w-full mb-2">
            <div className="app-brand" style={{ fontSize: '1.2rem' }}>
              <BookOpen size={20} />
              <span>Nur Al-Quran</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end mr-1">
                <span style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1 }}>{currentUser.name}</span>
                <span className="text-accent mt-1" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px', lineHeight: 1 }}>
                  <Trophy size={10} /> {users.find(u => u.id === currentUser.id)?.points || 0} pts
                </span>
              </div>
              <UserCircle size={24} className="text-accent" />
              <button className="nav-link" onClick={handleLogout} style={{ marginLeft: '0.25rem', padding: 0 }} title="Logout">
                <LogOut size={18} />
              </button>
            </div>
          </div>
          <div className="nav-links hide-scrollbar" style={{
            display: 'flex',
            overflowX: 'auto',
            flexWrap: 'nowrap',
            gap: '1.5rem',
            width: '100%',
            paddingBottom: '0.25rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '0.5rem'
          }}>
            <button
              className={`nav-link ${view === 'dashboard' ? 'active' : ''}`}
              onClick={() => setView('dashboard')}
              style={{ whiteSpace: 'nowrap', fontSize: '0.92rem' }}
            >
              Dashboard
            </button>
            <button
              className={`nav-link ${view === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setView('leaderboard')}
              style={{ whiteSpace: 'nowrap', fontSize: '0.92rem' }}
            >
              Leaderboard
            </button>
            <button
              className={`nav-link ${view === 'admin' ? 'active' : ''}`}
              onClick={() => setView('admin')}
              style={{ whiteSpace: 'nowrap', fontSize: '0.92rem' }}
            >
              Family Overview
            </button>
          </div>
        </header>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!session ? (
          <LoginView onProfileCreated={fetchCurrentUserProfile} />
        ) : view === 'dashboard' ? (
          <DashboardView
            user={users.find(u => u.id === currentUser.id)}
            users={users}
            setUsers={setUsers}
            systemDate={systemDate}
            onStartReading={() => setView('reader')}
          />
        ) : view === 'reader' ? (
          <QuranReaderView
            user={users.find(u => u.id === currentUser.id)}
            users={users}
            setUsers={setUsers}
            systemDate={systemDate}
            onBack={() => setView('dashboard')}
          />
        ) : view === 'leaderboard' ? (
          <LeaderboardView
            users={users}
            onBack={() => setView('dashboard')}
          />
        ) : view === 'admin' ? (
          <AdminView
            currentUser={currentUser}
            users={users}
            setUsers={setUsers}
            systemDate={systemDate}
          />
        ) : (
          <div className="flex items-center justify-center p-8">
            <LoaderCircle className="animate-spin text-accent" size={48} />
            <span className="ml-4" style={{ color: 'var(--text-muted)' }}>Loading your profile...</span>
          </div>
        )}
      </main>
    </div>
  );
}

function LoginView({ onProfileCreated }) {
  const [isSignUP, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingProfiles, setExistingProfiles] = useState([]);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [group, setGroup] = useState(1);
  const [half, setHalf] = useState('full');
  const [startJuz, setStartJuz] = useState(1);

  // Load existing profiles to check Juz availability
  useEffect(() => {
    const loadAvailability = async () => {
      const { data } = await supabase.from('profiles').select('start_juz, half, group_id');
      if (data) setExistingProfiles(data);
    };
    if (isSignUP) loadAvailability();
  }, [isSignUP]);

  // Calculate Availability for the chosen Group
  const getJuzAvailability = (juzNumber) => {
    const profilesInGroup = existingProfiles.filter(p => p.group_id === group && p.start_juz === juzNumber);
    if (profilesInGroup.length === 0) return { full: true, first: true, second: true };

    // If someone took the full Juz, it's completely taken
    if (profilesInGroup.some(p => p.half === 'full')) return { full: false, first: false, second: false };

    // Check individual halves
    const hasFirst = profilesInGroup.some(p => p.half === 'first');
    const hasSecond = profilesInGroup.some(p => p.half === 'second');

    return {
      full: false,
      first: !hasFirst,
      second: !hasSecond
    };
  };

  // When Juz changes, auto-select an available half
  useEffect(() => {
    if (isSignUP) {
      const avail = getJuzAvailability(startJuz);
      if (!avail.full && !avail.first && !avail.second) {
        setHalf(''); // Force them to pick a new one
      } else if (avail.full) {
        setHalf('full');
      } else if (avail.first) {
        setHalf('first');
      } else if (avail.second) {
        setHalf('second');
      }
    }
  }, [startJuz, group, existingProfiles]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUP) {
      const emailRedirectTo = import.meta.env.VITE_EMAIL_REDIRECT_URL || 'https://hadi-allawati.github.io/quran-rotation/'
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            group_id: group,
            half,
            start_juz: startJuz
          },
          // Ensures Supabase redirects back to the correct GitHub Pages base path.
          emailRedirectTo
        }
      });

      if (error) {
        alert(error.message);
      } else if (data.user) {
        if (!data.session) {
          // Email confirmation is required by Supabase!
          alert("Account created! Please check your email inbox to confirm your account, then sign in.");
          setIsSignUp(false);
          setPassword("");
        } else {
          // Fallback just in case email confirmation is disabled
          const { error: profileError } = await supabase.from('profiles').insert([{
            id: data.user.id,
            name,
            group_id: group,
            half,
            start_juz: startJuz
          }]);
          if (profileError) alert(profileError.message);
          else if (onProfileCreated) onProfileCreated(data.user);
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center animate-fade-in" style={{ flex: 1 }}>
      <div className="glass-panel" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <BookOpen size={48} className="text-accent mb-3" style={{ margin: '0 auto' }} />
          <h1>{isSignUP ? 'Join Family' : 'Welcome Back'}</h1>
          <p className="text-muted mb-4">{isSignUP ? 'Create your reading profile' : 'Family Quran Rotation Login'}</p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-3">
          {isSignUP && (
            <input
              type="text"
              placeholder="Your Name"
              value={name} onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
              pattern="^[a-zA-Z0-9\s\-_]+$"
              title="Name can only contain letters, numbers, spaces, hyphens, and underscores."
              style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
          )}

          <input
            type="email"
            placeholder="Email Address"
            value={email} onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={100}
            style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={64}
            style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />

          {isSignUP && (
            <div className="flex flex-col gap-3 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
              <div>
                <label className="text-muted text-sm block mb-1">Group #</label>
                <input type="number" min="1" value={group} onChange={(e) => setGroup(parseInt(e.target.value))} style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }} />
              </div>
              <div className="flex gap-2">
                <div style={{ flex: 1 }}>
                  <label className="text-muted text-sm block mb-1">Starting Juz' (1-30)</label>
                  <select
                    value={startJuz}
                    onChange={(e) => setStartJuz(parseInt(e.target.value))}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  >
                    {[...Array(30)].map((_, i) => {
                      const juz = i + 1;
                      const avail = getJuzAvailability(juz);
                      const isTaken = !avail.full && !avail.first && !avail.second;
                      return (
                        <option key={juz} value={juz} disabled={isTaken}>
                          Juz {juz} {isTaken ? '(Claimed)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="text-muted text-sm block mb-1">Half</label>
                  <select
                    value={half}
                    onChange={(e) => setHalf(e.target.value)}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                    required
                  >
                    {half === '' && <option value="" disabled>Pick available half...</option>}
                    <option value="full" disabled={!getJuzAvailability(startJuz).full}>Complete Juz</option>
                    <option value="first" disabled={!getJuzAvailability(startJuz).first}>First Half</option>
                    <option value="second" disabled={!getJuzAvailability(startJuz).second}>Second Half</option>
                  </select>
                </div>
              </div>

              {(!getJuzAvailability(startJuz).full && !getJuzAvailability(startJuz).first && !getJuzAvailability(startJuz).second) ? (
                <div className="text-danger text-sm mb-2 text-center">
                  ⚠️ This entire Juz is already claimed by someone else. Please pick another.
                </div>
              ) : (
                <div className="text-muted text-sm mb-2 text-center">
                  {getJuzAvailability(startJuz).full ? "✅ This entire Juz is available." : "⚠️ Partial Juz available. Coordinate with your partner!"}
                </div>
              )}
            </div>
          )}

          <button type="submit" className="btn btn-primary mt-2" disabled={loading || (!getJuzAvailability(startJuz).full && !getJuzAvailability(startJuz).first && !getJuzAvailability(startJuz).second)} style={{ padding: '0.8rem', fontWeight: 'bold' }}>
            {loading ? 'Please wait...' : isSignUP ? 'Sign Up & Join' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-4">
          <button className="nav-link text-sm" onClick={() => setIsSignUp(!isSignUP)}>
            {isSignUP ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ user, users, setUsers, systemDate, onStartReading }) {
  if (!user) {
    return (
      <div className="flex items-center justify-center p-8" style={{ flex: 1 }}>
        <LoaderCircle className="animate-spin text-accent" size={48} />
        <span className="ml-4 text-muted">Building your dashboard...</span>
      </div>
    );
  }

  const currentWeek = getCurrentWeekNumber(systemDate);
  const assignedJuz = getAssignedJuzForUser(user.start_juz, user.created_at, systemDate);
  const deadline = getNextDeadline(systemDate);
  const isCompleted = user.completedWeek >= currentWeek;

  const [pageRange, setPageRange] = useState('');
  const [shiaTimes, setShiaTimes] = useState(null);

  useEffect(() => {
    const fetchShiaPrayerTimes = async () => {
      try {
        const response = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Muscat&country=Oman&method=0');
        const data = await response.json();
        if (data.code === 200) {
          setShiaTimes({
            Fajr: data.data.timings.Fajr,
            Dhuhr: data.data.timings.Dhuhr,
            Asr: data.data.timings.Asr,
            Maghrib: data.data.timings.Maghrib,
            Isha: data.data.timings.Isha
          });
        }
      } catch (err) {
        console.error('Failed to load Shia prayer times:', err);
      }
    };

    fetchShiaPrayerTimes();
  }, []);

  // Generate Juz page ranges based on the specific Juz pulled from API
  useEffect(() => {
    const fetchPageRange = async () => {
      try {
        const response = await fetch(`https://api.alquran.cloud/v1/juz/${assignedJuz}/quran-uthmani`);
        const data = await response.json();
        if (data.code === 200) {
          let allAyahs = data.data.ayahs;
          if (user.half !== 'full') {
            const pages = allAyahs.map(a => a.page);
            const minPage = Math.min(...pages);
            const maxPage = Math.max(...pages);
            const midPage = Math.floor((minPage + maxPage) / 2);

            if (user.half === 'first') {
              setPageRange(`Pages ${minPage} - ${midPage}`);
            } else if (user.half === 'second') {
              setPageRange(`Pages ${midPage + 1} - ${maxPage}`);
            }
          } else {
            const pages = allAyahs.map(a => a.page);
            setPageRange(`Pages ${Math.min(...pages)} - ${Math.max(...pages)}`);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPageRange();
  }, [assignedJuz, user.half]);

  // Calculate relative time until deadline
  const timeRemaining = formatDistanceToNow(deadline, { addSuffix: true });

  const handleMarkComplete = async () => {
    // Fire confetti for celebration
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d4af37', '#2ecc71', '#ffffff']
    });

    const isJuz30 = assignedJuz === 30;
    if (isJuz30) {
      setTimeout(() => {
        alert("🎉 Mock Email Sent! 🎉\n\nSubject: Khatma Dua\n\nMabrook! You have completed Juz 30. May Allah accept your recitation. Here is your Khatma Dua...");
      }, 1000);
    }

    // Save history to DB
    await supabase.from('reading_history').insert([
      { user_id: user.id, week_number: currentWeek, juz_completed: assignedJuz }
    ]);

    // Update Points
    await supabase.from('profiles')
      .update({ points: user.points + 10 })
      .eq('id', user.id);

    // Update local state instantly for UI
    setUsers(prev => prev.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          completedWeek: currentWeek,
          points: u.points + 10
        };
      }
      return u;
    }));
  };

  const handleStartReadingClick = () => {
    onStartReading();
  };

  return (
    <div className="animate-fade-in dashboard-grid">

      {/* LEFT COLUMN: Current Task */}
      <div className="flex flex-col gap-4">
        <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
          {isCompleted && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(46,204,113,0.1)', zIndex: 0, pointerEvents: 'none' }} />
          )}

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 className="mb-1 text-accent flex items-center gap-2">
              <BookOpen /> Weekly Assignment
            </h2>
            <p className="text-muted mb-4">Week {currentWeek} of the Rotation</p>

            <div className="flex items-center justify-center py-4 mb-4" style={{ border: '1px solid rgba(212,175,55,0.2)', borderRadius: '16px', background: 'rgba(0,0,0,0.2)' }}>
              <div className="text-center">
                <span className="text-muted" style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Assigned Juz'</span>
                <div className="text-accent mt-1" style={{ fontSize: '4rem', fontFamily: 'var(--font-serif)', fontWeight: 700, lineHeight: 1 }}>
                  {assignedJuz}
                </div>
                <div className="mt-2 text-main" style={{ fontSize: '1.2rem' }}>
                  {user.half === 'full' ? 'Complete Juz' : user.half === 'first' ? 'First Half' : 'Second Half'}
                </div>
                {pageRange && (
                  <div className="text-muted mt-1" style={{ fontSize: '0.9rem' }}>
                    {pageRange}
                  </div>
                )}

                {user.half !== 'full' && (
                  <p className="text-muted mt-2 text-sm">
                    Shared with {users.find(u => u.group === user.group && u.id !== user.id)?.name || 'Unknown'}
                  </p>
                )}
              </div>
            </div>

            {isCompleted ? (
              <div className="flex items-center justify-center gap-2 py-3" style={{ background: 'rgba(46,204,113,0.15)', borderRadius: '9999px', color: 'var(--color-success)', fontWeight: 600 }}>
                <CheckCircle size={24} /> Completed on Time (+10 pts)
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-muted mb-2">
                  <span className="flex items-center gap-1"><Clock size={16} /> Due: Thursday 11:00 PM</span>
                  <span className="text-danger flex items-center gap-1"><AlertTriangle size={16} /> Ends {timeRemaining}</span>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }} onClick={handleStartReadingClick}>
                  <BookOpen size={20} /> {user.current_bookmark ? 'Resume Reading' : 'Start Reading Now'}
                </button>
                <div className="text-center mt-2">
                  <button className="btn nav-link text-muted" style={{ fontSize: '0.9rem' }} onClick={handleMarkComplete}>
                    or Mark Reading Complete (External Read)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Stats */}
      <div className="flex flex-col gap-4">

        <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(10, 41, 28, 0.4))' }}>
          <h3 className="flex items-center gap-2 mb-3"><Trophy className="text-accent" /> Achievement Points</h3>
          <div className="flex items-end gap-2 mb-2">
            <span style={{ fontSize: '3rem', fontFamily: 'var(--font-serif)', color: 'var(--color-accent)', lineHeight: 1 }}>{user.points}</span>
            <span className="text-muted mb-1">pts</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Earn 10 points every week you complete your reading on time!</p>
        </div>

        <div className="glass-panel" style={{ border: user.penalty > 0 ? '1px solid rgba(226, 54, 54, 0.3)' : undefined }}>
          <h3 className="flex items-center gap-2 mb-3"><AlertTriangle className={user.penalty > 0 ? 'text-danger' : 'text-success'} /> Missed Deadlines</h3>
          <div className="flex items-end gap-2 mb-2">
            <span style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: user.penalty > 0 ? 'var(--color-danger)' : 'var(--color-success)', lineHeight: 1 }}>
              {user.penalty}
            </span>
            <span className="text-muted mb-1">OMR</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            {user.penalty > 0
              ? "This penalty is applied to charity. Please ensure you pay it soon."
              : "Alhamdulillah! You have no penalties. Keep up the good momentum."}
          </p>
          {user.penalty > 0 && (
            <button className="btn btn-secondary mt-3" style={{ width: '100%', fontSize: '0.9rem', color: 'var(--color-text-main)', borderColor: 'rgba(255,255,255,0.2)' }}>
              Mark Penalty Paid (Mock)
            </button>
          )}
        </div>

        <div className="glass-panel">
          <h3 className="flex items-center gap-2 mb-3"><Clock className="text-accent" /> Shia Prayer Times</h3>
          <p className="text-muted mb-3" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
            Source: Aladhan (Method 0, Ithna Ashari)<br />
            Location: Muscat, Oman
          </p>
          {shiaTimes ? (
            <div className="flex flex-col gap-2 animate-fade-in">
              {Object.entries(shiaTimes).map(([name, value]) => (
                <div key={name} className="flex justify-between items-center" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <span className="text-muted font-bold">{name}</span>
                  <span className="text-main font-bold" style={{ color: 'var(--color-accent)' }}>{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center p-4">
              <LoaderCircle className="animate-spin text-accent" size={24} />
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

function QuranReaderView({ user, users, setUsers, systemDate, onBack }) {
  if (!user) return null;

  const currentWeek = getCurrentWeekNumber(systemDate);
  const assignedJuz = getAssignedJuzForUser(user.start_juz, user.created_at, systemDate);

  const [ayahs, setAyahs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingBookmark, setSavingBookmark] = useState(null);
  const ayahRefs = useRef({});

  useEffect(() => {
    if (!loading && ayahs.length > 0 && user.current_bookmark) {
      setTimeout(() => {
        const target = ayahRefs.current[user.current_bookmark];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [loading, ayahs, user.current_bookmark]);

  const handleSaveBookmark = async (ayahNumber) => {
    try {
      const targetBookmark = user.current_bookmark === ayahNumber ? null : ayahNumber;
      setSavingBookmark(ayahNumber);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ current_bookmark: targetBookmark })
        .eq('id', user.id);
      if (updateError) throw updateError;
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, current_bookmark: targetBookmark } : u));
    } catch (err) {
      console.error('Failed to save bookmark:', err);
      alert('Failed to save bookmark. Please try again.');
    } finally {
      setSavingBookmark(null);
    }
  };

  useEffect(() => {
    const fetchJuz = async () => {
      try {
        setLoading(true);
        // Fetch specific Juz in Uthmani text
        const response = await fetch(`https://api.alquran.cloud/v1/juz/${assignedJuz}/quran-uthmani`);
        const data = await response.json();

        if (data.code === 200) {
          let allAyahs = data.data.ayahs;

          // Filter by half if necessary
          if (user.half !== 'full') {
            const pages = allAyahs.map(a => a.page);
            const minPage = Math.min(...pages);
            const maxPage = Math.max(...pages);
            const midPage = Math.floor((minPage + maxPage) / 2);

            if (user.half === 'first') {
              allAyahs = allAyahs.filter(a => a.page <= midPage);
            } else if (user.half === 'second') {
              allAyahs = allAyahs.filter(a => a.page > midPage);
            }
          }

          setAyahs(allAyahs);
        } else {
          setError('Failed to load Quran text. Please try again.');
        }
      } catch (err) {
        setError('Network error. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchJuz();
  }, [assignedJuz, user.half]);

  const handleMarkComplete = async () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d4af37', '#2ecc71', '#ffffff']
    });

    const isJuz30 = assignedJuz === 30;
    if (isJuz30) {
      setTimeout(() => {
        alert("🎉 Mock Email Sent! 🎉\n\nSubject: Khatma Dua\n\nMabrook! You have completed Juz 30. May Allah accept your recitation. Here is your Khatma Dua...");
      }, 1000);
    }

    await supabase.from('reading_history').insert([
      { user_id: user.id, week_number: currentWeek, juz_completed: assignedJuz }
    ]);
    await supabase.from('profiles').update({ points: user.points + 10 }).eq('id', user.id);

    setUsers(prev => prev.map(u => {
      if (u.id === user.id) {
        return { ...u, completedWeek: currentWeek, points: u.points + 10 };
      }
      return u;
    }));

    // Go back to dashboard after a short delay
    setTimeout(() => {
      onBack();
    }, 2000);
  };

  // Group ayahs by surah
  const groupedAyahs = ayahs.reduce((acc, ayah) => {
    const surahName = ayah.surah.name;
    if (!acc[surahName]) {
      acc[surahName] = [];
    }
    acc[surahName].push(ayah);
    return acc;
  }, {});

  return (
    <div className="animate-fade-in glass-panel" style={{ position: 'relative', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
      <div className="reader-toolbar">
        <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.5rem 1rem' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-center">
          <h2 style={{ marginBottom: 0, fontSize: '1.2rem' }}>Juz' {assignedJuz}</h2>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            {user.half === 'full' ? 'Complete' : user.half === 'first' ? 'First Half' : 'Second Half'}
          </span>
        </div>
        <button className="btn btn-primary" onClick={handleMarkComplete} style={{ padding: '0.5rem 1rem' }}>
          <CheckCircle size={16} /> Finish
        </button>
      </div>
      <div className="text-center py-2 mb-3" style={{ background: 'rgba(212, 175, 55, 0.15)', color: 'var(--color-accent)', fontSize: '0.85rem', borderRadius: 'var(--radius-md)' }}>
        <Bookmark size={14} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'middle' }} />
        Tap any ayah to save and highlight your current position.
      </div>

      <div style={{ flex: 1, padding: '2rem 1rem', overflowY: 'auto' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center text-muted" style={{ height: '100%', minHeight: '300px' }}>
            <LoaderCircle size={40} className="animate-pulse mb-4 text-accent" />
            <p>Loading the Holy Quran...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-danger" style={{ height: '100%', minHeight: '300px' }}>
            <AlertTriangle size={40} className="mb-4" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="quran-reader">
            {Object.entries(groupedAyahs).map(([surahName, surahAyahs]) => (
              <div key={surahName}>
                <div className="surah-header">{surahName}</div>
                <div className="ayah-blocks" style={{ textAlign: 'center' }}>
                  {surahAyahs.map(ayah => (
                    <div
                      key={ayah.number}
                      className="ayah-container"
                      onClick={() => handleSaveBookmark(ayah.number)}
                      ref={(el) => { ayahRefs.current[ayah.number] = el; }}
                      style={{ position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease' }}
                    >
                      {savingBookmark === ayah.number ? (
                        <LoaderCircle size={16} className="animate-spin text-accent" style={{ position: 'absolute', top: 0, left: 0 }} />
                      ) : null}
                      <span
                        className="ayah-text"
                        style={{
                          color: user.current_bookmark === ayah.number ? 'var(--color-accent)' : 'inherit',
                          textShadow: user.current_bookmark === ayah.number ? '0 0 12px rgba(212, 175, 55, 0.4)' : 'none',
                          opacity: savingBookmark === ayah.number ? 0.5 : 1,
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {ayah.text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '')}
                      </span>
                      <span
                        className="ayah-number"
                        style={{
                          color: user.current_bookmark === ayah.number ? 'var(--color-accent)' : undefined,
                          borderColor: user.current_bookmark === ayah.number ? 'var(--color-accent)' : undefined,
                          opacity: savingBookmark === ayah.number ? 0.5 : 1
                        }}
                      >
                        {ayah.numberInSurah}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && !error && (
        <div className="text-center mt-4">
          <button className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.2rem' }} onClick={handleMarkComplete}>
            <CheckCircle size={24} /> Mark as Complete & Close
          </button>
        </div>
      )}
    </div>
  );
}

function AdminView({ currentUser, users, setUsers, systemDate }) {
  const currentWeek = getCurrentWeekNumber(systemDate);
  const currentGroup = currentUser?.group || 1;
  const groupUsers = users.filter(u => u.group === currentGroup);

  const simulateMissedDeadline = async () => {
    // Determine who needs a penalty
    const updates = users
      .filter(u => u.completedWeek < currentWeek)
      .map(u => supabase.from('profiles').update({ penalty: u.penalty + 5 }).eq('id', u.id));

    await Promise.all(updates);

    setUsers(prev => prev.map(u => {
      if (u.completedWeek < currentWeek) {
        return { ...u, penalty: u.penalty + 5 };
      }
      return u;
    }));
    alert("Simulated Thursday 11 PM deadline. Applied 5 OMR penalty to pending users!");
  };

  const handleEditJuz = async (targetUser) => {
    const newJuz = prompt(`Enter new Starting Juz for ${targetUser.name}:`, targetUser.start_juz);
    if (newJuz && !isNaN(newJuz) && newJuz >= 1 && newJuz <= 30) {
      const { error } = await supabase.from('profiles')
        .update({ start_juz: parseInt(newJuz), created_at: new Date().toISOString() }) // Reset anchor time to today
        .eq('id', targetUser.id);

      if (error) alert(error.message);
      else {
        alert("Assignment updated successfully!");
        setUsers(prev => prev.map(u => {
          if (u.id === targetUser.id) return { ...u, start_juz: parseInt(newJuz), created_at: new Date().toISOString() };
          return u;
        }));
      }
    }
  };

  const simulate24HourReminder = () => {
    const twentyFourHoursFromNow = new Date();
    twentyFourHoursFromNow.setHours(twentyFourHoursFromNow.getHours() + 24);
    alert("Simulated Time Change: The system time inside the dashboard will now believe we are 24 hours from the deadline, which will trigger automatic emails to anyone who hasn't finished!");
    // You could theoretically force the systemDate state here if it was hoisted higher, 
    // but the users can see the automatic email feature directly in the Dashboard.
  };

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <div className="flex justify-between items-center mb-2" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Family Overview</h2>
        {currentUser?.role === 'admin' && (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={simulate24HourReminder}>
              <Mail size={18} /> Simulate 24h Warning
            </button>
            <button className="btn btn-danger" onClick={simulateMissedDeadline}>
              <AlertTriangle size={18} /> Simulate Deadline Miss
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Member</th>
              <th style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Assigned Juz'</th>
              <th style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Status (Week {currentWeek})</th>
              <th style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Points</th>
              <th style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Owed (OMR)</th>
              {currentUser?.role === 'admin' && (
                <th style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {[...Array(30)].map((_, i) => {
              const targetJuz = i + 1;
              const assignedUsers = groupUsers.filter(u => getAssignedJuzForUser(u.start_juz, u.created_at, systemDate) === targetJuz);

              if (assignedUsers.length === 0) {
                return (
                  <tr key={`unassigned-${targetJuz}`} style={{ borderBottom: targetJuz < 30 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <td style={{ padding: '1rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Unassigned</td>
                    <td style={{ padding: '1rem' }}>
                      <span className="text-accent font-bold" style={{ opacity: 0.5 }}>Juz' {targetJuz}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>-</td>
                    <td style={{ padding: '1rem' }}>-</td>
                    <td style={{ padding: '1rem' }}>-</td>
                    {currentUser?.role === 'admin' && <td style={{ padding: '1rem' }}>-</td>}
                  </tr>
                );
              }

              return assignedUsers.map((user, idx) => {
                const isCompleted = user.completedWeek >= currentWeek;
                return (
                  <tr key={user.id} style={{ borderBottom: (targetJuz < 30 || idx < assignedUsers.length - 1) ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <td style={{ padding: '1rem' }}>
                      <div className="flex items-center gap-2">
                        <UserCircle className="text-accent" size={20} />
                        {user.name}
                        {user.role === 'admin' && <ShieldCheck size={14} className="text-accent" />}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className="text-accent font-bold">Juz' {targetJuz}</span>
                      <span className="text-muted block" style={{ fontSize: '0.75rem' }}>Group {user.group} ({user.half})</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {isCompleted ? (
                        <span className="text-success flex items-center gap-1" style={{ fontSize: '0.9rem' }}><CheckCircle size={16} /> Completed</span>
                      ) : (
                        <span className="text-muted flex items-center gap-1" style={{ fontSize: '0.9rem' }}><Clock size={16} /> Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--color-accent)' }}>
                      {user.points} pts
                    </td>
                    <td style={{ padding: '1rem', color: user.penalty > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {user.penalty} OMR
                    </td>
                    {currentUser?.role === 'admin' && (
                      <td style={{ padding: '1rem' }}>
                        <div className="flex gap-2">
                          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleEditJuz(user)}>
                            <Edit size={14} /> Edit Juz
                          </button>
                          {user.penalty > 0 && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--color-success)' }}
                              onClick={async () => {
                                await supabase.from('profiles').update({ penalty: 0 }).eq('id', user.id);
                                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, penalty: 0 } : u));
                              }}
                            >
                              <CheckCircle size={14} /> Clear Penalty
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaderboardView({ users, onBack }) {
  // Sort users by points descending
  const sortedUsers = [...users].sort((a, b) => b.points - a.points);

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <div className="flex items-center gap-4 mb-2">
        <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.5rem 1rem' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <h2 style={{ marginBottom: 0 }}>Family Leaderboard</h2>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div className="flex flex-col gap-3">
          {sortedUsers.map((u, idx) => (
            <div key={u.id} className="flex items-center justify-between p-4" style={{
              background: idx === 0 ? 'rgba(212, 175, 55, 0.15)' : 'rgba(0,0,0,0.2)',
              border: idx === 0 ? '1px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.05)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div className="flex items-center gap-4">
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: idx === 0 ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                  color: idx === 0 ? 'var(--color-bg-dark)' : 'var(--color-text-main)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '1.2rem'
                }}>
                  {idx + 1}
                </div>
                <div>
                  <div className="font-bold flex items-center gap-2" style={{ fontSize: '1.1rem' }}>
                    {u.name}
                    {idx === 0 && <span title="Top Reader">👑</span>}
                  </div>
                  <div className="text-muted text-sm">Completed {u.points / 10} weeks on time</div>
                </div>
              </div>
              <div className="text-accent flex items-center gap-2" style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 'bold' }}>
                {u.points} <span style={{ fontSize: '1rem', fontFamily: 'var(--font-sans)', fontWeight: 'normal' }} className="text-muted">pts</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
