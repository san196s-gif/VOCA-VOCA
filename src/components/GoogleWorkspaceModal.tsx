import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  Mail,
  Send,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
  LogOut,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  signInWithGoogle,
  logoutGoogle,
  listGoogleDriveFiles,
  readGoogleDriveFileContent,
  uploadPodcastToDrive,
  sendPodcastViaGmail,
  saveEpisodeToFirestore,
  GoogleDriveFile,
} from '../services/googleWorkspace';
import { ScriptSegment } from '../types';

interface GoogleWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onAuthChange: (user: User | null) => void;
  onImportText: (text: string) => void;
  currentEpisode?: {
    id: string;
    title: string;
    audioUrl: string;
    durationSec: number;
    script: ScriptSegment[];
    voices: string[];
  } | null;
}

export const GoogleWorkspaceModal: React.FC<GoogleWorkspaceModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthChange,
  onImportText,
  currentEpisode,
}) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'gmail'>('drive');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Drive state
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [uploadedDriveLink, setUploadedDriveLink] = useState<string | null>(null);

  // Gmail state
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadDriveFiles();
    }
    if (currentEpisode) {
      setEmailSubject(`Podcast AI Episode: ${currentEpisode.title || 'Multi-Speaker Audio'}`);
    }
  }, [isOpen, currentUser]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        onAuthChange(res.user);
        setSuccessMsg(`Signed in as ${res.user.email}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setErrorMsg(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logoutGoogle();
    onAuthChange(null);
    setDriveFiles([]);
    setSuccessMsg(null);
  };

  const loadDriveFiles = async () => {
    setIsLoadingFiles(true);
    setErrorMsg(null);
    try {
      const files = await listGoogleDriveFiles();
      setDriveFiles(files);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not list files';
      setErrorMsg(msg);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleImportFile = async (file: GoogleDriveFile) => {
    setErrorMsg(null);
    try {
      const content = await readGoogleDriveFileContent(file.id);
      onImportText(content);
      setSuccessMsg(`Imported "${file.name}" from Google Drive into text input!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import file';
      setErrorMsg(msg);
    }
  };

  const handleUploadEpisodeToDrive = async () => {
    if (!currentEpisode) return;
    setIsUploadingToDrive(true);
    setErrorMsg(null);
    try {
      const res = await uploadPodcastToDrive(
        currentEpisode.title,
        currentEpisode.audioUrl,
        currentEpisode.script
      );
      if (currentUser) {
        await saveEpisodeToFirestore(
          currentUser.uid,
          currentEpisode.id,
          currentEpisode.title,
          currentEpisode.durationSec,
          currentEpisode.voices,
          currentEpisode.script,
          res.fileId
        );
      }
      setUploadedDriveLink(res.webViewLink || null);
      setSuccessMsg('Podcast master file uploaded to your Google Drive and saved to Firestore!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Drive upload failed';
      setErrorMsg(msg);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Explicit confirmation before sending email (required by Workspace integration skill)
  const confirmAndSendEmail = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setErrorMsg('Please enter a valid recipient email address.');
      return;
    }
    setShowSendConfirmation(true);
  };

  const executeSendEmail = async () => {
    setShowSendConfirmation(false);
    setIsSendingEmail(true);
    setErrorMsg(null);
    try {
      const snippet = currentEpisode?.script.slice(0, 4).map(s => `${s.speaker_name}: ${s.text}`).join('\n') || 'Podcast audio file generated by Podcast AI.';
      await sendPodcastViaGmail(
        recipientEmail,
        emailSubject,
        currentEpisode?.title || 'Podcast Episode',
        snippet,
        currentEpisode?.durationSec || 60
      );
      setSuccessMsg(`Email successfully sent to ${recipientEmail}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send email';
      setErrorMsg(msg);
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Google Workspace & Cloud Sync</h3>
              <p className="text-xs text-slate-400">
                Google Drive files, Gmail sharing, and Firebase sync
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auth Bar */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {currentUser ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <img
                  src={currentUser.photoURL || 'https://lh3.googleusercontent.com/a/default-user'}
                  alt="User"
                  className="w-6 h-6 rounded-full border border-slate-700"
                />
                <span className="text-xs text-slate-200 font-medium">{currentUser.email}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Connected
                </span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <span className="text-xs text-slate-300">
                Connect your Google Account to access Drive and Gmail:
              </span>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 shadow transition-all active:scale-95 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/20 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'drive'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Google Drive</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gmail')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'gmail'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Gmail Share</span>
          </button>
        </div>

        {/* Feedback banners */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-4">
          {activeTab === 'drive' && (
            <div className="space-y-4">
              {/* Export Current Episode to Drive Section */}
              {currentEpisode && (
                <div className="p-4 rounded-xl bg-slate-950/50 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        Export Rendered Episode to Google Drive
                      </h4>
                      <p className="text-xs text-slate-400">
                        {currentEpisode.title} ({(currentEpisode.durationSec / 60).toFixed(1)} min)
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!currentUser || isUploadingToDrive}
                      onClick={handleUploadEpisodeToDrive}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 transition-colors shadow"
                    >
                      {isUploadingToDrive ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload to Drive</span>
                        </>
                      )}
                    </button>
                  </div>
                  {uploadedDriveLink && (
                    <a
                      href={uploadedDriveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open uploaded file in Google Drive</span>
                    </a>
                  )}
                </div>
              )}

              {/* Import from Drive Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Import Document or Script from Drive</span>
                  </h4>
                  <button
                    type="button"
                    onClick={loadDriveFiles}
                    disabled={!currentUser || isLoadingFiles}
                    className="text-xs text-slate-400 hover:text-amber-400 underline decoration-slate-700"
                  >
                    Refresh List
                  </button>
                </div>

                {!currentUser ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Sign in with Google above to view and import your documents from Google Drive.
                  </p>
                ) : isLoadingFiles ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Loading your Google Drive files...</span>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No files found in your Google Drive.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {driveFiles.map(file => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-slate-700 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span className="truncate text-slate-200">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleImportFile(file)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors font-medium flex-shrink-0 text-[11px]"
                        >
                          Import Text
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'gmail' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Send a notification and transcript preview of this generated podcast directly via your Gmail account.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Recipient Email:
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    placeholder="listener@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Subject:
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={!currentUser || !recipientEmail || isSendingEmail}
                    onClick={confirmAndSendEmail}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 transition-all shadow"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending via Gmail...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send via Gmail</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal for Sending Email (Workspace Mandatory User Confirmation) */}
        {showSendConfirmation && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div className="max-w-md w-full p-5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-amber-400">
                <ShieldAlert className="w-6 h-6" />
                <h4 className="text-sm font-bold text-white">Confirm Email Delivery</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to send this podcast episode email to{' '}
                <strong className="text-amber-300">{recipientEmail}</strong> with subject "{emailSubject}"?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSendConfirmation(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeSendEmail}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow"
                >
                  Confirm & Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
