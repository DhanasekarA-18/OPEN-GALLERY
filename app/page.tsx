"use client";

import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { useEffect, useState, useRef, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import {
  Upload,
  LogIn,
  ImageIcon,
  CheckCircle,
  Send,
  Loader2,
  X,
  AlertCircle,
  User as UserIcon,
  Clock,
  Eye,
  Trash2,
  Plus,
  Files,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PHOTOS_LIMIT, ACCEPTED_IMAGE_EXTENSIONS } from "@/lib/constants";

interface Photo {
  _id: string;
  url: string;
  title: string;
  uploadedBy: string;
  createdAt: string;
  contentType: string;
}

const getExtension = (contentType: string) => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
  };
  return map[contentType] || contentType.split('/')[1] || 'bin';
};

const isPreviewable = (contentType: string) => {
  return [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif',
    'image/bmp',
  ].includes(contentType.toLowerCase());
};

interface User {
  email: string;
}

interface FileWithMetadata {
  file: File;
  preview: string;
  title: string;
  id: string;
}

export default function OpenGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1); // 1: Email, 2: OTP
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [isDBConnected, setIsDBConnected] = useState(true);
  const [error, setError] = useState("");

  // Multiple Upload State
  const [uploadItems, setUploadItems] = useState<FileWithMetadata[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const PhotoSkeleton = () => (
    <div className="flex flex-col group">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[40px] bg-slate-100 dark:bg-zinc-950 shadow-sm animate-pulse">
        <div className="shimmer absolute inset-0 opacity-20 dark:opacity-10" />
      </div>
      <div className="mt-8 px-6 space-y-4">
        <div className="h-6 w-3/4 rounded-lg bg-slate-100 dark:bg-zinc-950 relative overflow-hidden">
          <div className="shimmer absolute inset-0 opacity-20 dark:opacity-10" />
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-6 dark:border-white/5 mt-6">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-2xl bg-slate-100 dark:bg-zinc-950 relative overflow-hidden">
              <div className="shimmer absolute inset-0 opacity-20 dark:opacity-10" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-12 rounded bg-slate-100 dark:bg-zinc-950 relative overflow-hidden">
                <div className="shimmer absolute inset-0 opacity-20 dark:opacity-10" />
              </div>
              <div className="h-4 w-20 rounded bg-slate-100 dark:bg-zinc-950 relative overflow-hidden">
                <div className="shimmer absolute inset-0 opacity-20 dark:opacity-10" />
              </div>
            </div>
          </div>
          <div className="space-y-2 flex flex-col items-end">
            <div className="h-3 w-16 rounded bg-slate-100 dark:bg-zinc-950 relative overflow-hidden">
              <div className="shimmer absolute inset-0 opacity-20 dark:opacity-10" />
            </div>
            <div className="h-4 w-24 rounded bg-slate-100 dark:bg-zinc-950 relative overflow-hidden">
              <div className="shimmer absolute inset-0 opacity-20 dark:opacity-10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Pagination & Infinite Scroll
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const { ref, inView } = useInView();

  useEffect(() => {
    checkAuth();
    fetchPhotos(1, true);
    checkDBStatus();
  }, []);

  const checkDBStatus = async () => {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) setIsDBConnected(false);
      else setIsDBConnected(true);
    } catch (e) {
      setIsDBConnected(false);
    }
  };

  useEffect(() => {
    if (inView && hasMore && !isFetchingMore && !loading) {
      fetchPhotos(page + 1);
    }
  }, [inView, hasMore, isFetchingMore, loading, page]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setUser(data.user);
      }
    } catch (e) { }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        setIsAuthenticated(false);
        setUser(null);
        setIsLogoutModalOpen(false);
        setOtp("");
        setError("");
        setStep(1);
      }
    } catch (err) { }
  };

  const fetchPhotos = async (pageNum: number, isInitial = false) => {
    if (isInitial) setLoading(true);
    else setIsFetchingMore(true);

    try {
      const res = await fetch(`/api/photos?page=${pageNum}&limit=${PHOTOS_LIMIT}`);
      const data = await res.json();

      if (isInitial) {
        setPhotos(data.photos);
      } else {
        setPhotos(prev => [...prev, ...data.photos]);
      }

      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!photoToDelete) return;

    setDeleteLoading(true);
    try {
      const res = await fetch("/api/photos", {
        method: "DELETE",
        body: JSON.stringify({ id: photoToDelete }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setPhotos(prev => prev.filter(p => p._id !== photoToDelete));
        setIsDeleteModalOpen(false);
        setPhotoToDelete(null);
      } else {
        const d = await res.json();
        alert(d.message || "Failed to delete photo");
      }
    } catch (err) {
      alert("Error deleting photo");
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteModal = (photoId: string) => {
    setPhotoToDelete(photoId);
    setIsDeleteModalOpen(true);
  };

  const handleSendOtp = async () => {
    if (!email) return setError("Email is required");
    setAuthLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setStep(2);
      } else {
        const d = await res.json();
        setError(d.message || "Something went wrong");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return setError("OTP is required");
    setAuthLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setUser(data.user);
        setIsAuthModalOpen(false);
        setIsUploadModalOpen(true);
      } else {
        const d = await res.json();
        setError(d.message || "Invalid OTP");
      }
    } catch (err) {
      setError("Verification failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await addFiles(files);
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const newItems: FileWithMetadata[] = [];
    setUploadLoading(true);

    try {
      for (const file of files) {
        newItems.push({
          file: file,
          preview: URL.createObjectURL(file),
          title: file.name.split('.')[0],
          id: Math.random().toString(36).substr(2, 9)
        });
      }

      setUploadItems(prev => [...prev, ...newItems]);
    } finally {
      setUploadLoading(false);
    }
  };

  const removeFile = (id: string) => {
    setUploadItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const updateTitle = (id: string, title: string) => {
    setUploadItems(prev => prev.map(i => i.id === id ? { ...i, title } : i));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await addFiles(files);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadItems.length === 0) return setError("Please select at least one photo");
    setUploadLoading(true);
    setError("");

    try {
      const formData = new FormData();
      uploadItems.forEach(item => {
        formData.append("files", item.file);
        formData.append("titles", item.title);
      });

      const res = await fetch("/api/photos", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setIsUploadModalOpen(false);
        // Clear items and revocation
        uploadItems.forEach(i => URL.revokeObjectURL(i.preview));
        setUploadItems([]);
        fetchPhotos(1, true);
      } else {
        const d = await res.json();
        setError(d.message || "Failed to save photos to gallery");
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownload = (photo: Photo) => {
    const link = document.createElement("a");
    link.href = photo.url;
    const extension = getExtension(photo.contentType);
    link.download = `${photo.title.replace(/\s+/g, "_") || "shot"}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1A1A1A] font-sans dark:bg-[#0A0A0A] dark:text-[#F5F5F5]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/70 backdrop-blur-xl dark:border-white/5 dark:bg-black/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/20">
              <ImageIcon size={26} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight leading-none uppercase">Gallery</span>
              <span className="text-[10px] font-bold text-indigo-500 tracking-[0.2em] mt-1 uppercase">DS Open Community</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && user && (
              <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white p-1.5 pr-4 shadow-sm dark:border-white/10 dark:bg-zinc-900 md:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
                  <span className="text-sm font-bold uppercase">{user.email[0]}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Active User</span>
                  <span className="text-sm font-semibold truncate max-w-[100px] text-slate-700 dark:text-zinc-200">{user.email.split('@')[0]}</span>
                </div>
                <button
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all dark:hover:bg-rose-500/10"
                  title="Logout"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <button
              onClick={() => (isAuthenticated ? setIsUploadModalOpen(true) : setIsAuthModalOpen(true))}
              className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-[#1A1A1A] px-7 py-3 text-sm font-bold text-white transition-all hover:scale-105 hover:bg-black active:scale-95 dark:bg-white dark:text-black dark:hover:bg-slate-100"
            >
              {isAuthenticated ? (
                <>
                  <Upload size={18} className="transition-transform group-hover:-translate-y-1" />
                  <span>Share Shot</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Get Started</span>
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Database Connection Alert Banner */}
      <AnimatePresence>
        {!isDBConnected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-rose-500 text-white"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <AlertCircle size={18} />
              <span className="text-sm font-black uppercase tracking-widest">
                Database connection failed. Some features may be unavailable.
              </span>
              <button
                onClick={checkDBStatus}
                className="ml-4 rounded-full border border-white/30 bg-white/20 px-4 py-1 text-[10px] font-black uppercase transition-all hover:bg-white hover:text-rose-500"
              >
                Retry Connection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <header className="relative mx-auto max-w-7xl px-4 py-8 text-center sm:px-6 lg:px-8">
        <div className="absolute top-0 left-1/2 -z-10 h-24 w-full -translate-x-1/2 bg-gradient-to-b from-indigo-50/30 to-transparent dark:from-indigo-950/10" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <h1 className="bg-gradient-to-r from-[#1A1A1A] to-slate-500 bg-clip-text text-3xl font-black tracking-tight text-transparent dark:from-white dark:to-zinc-500 sm:text-4xl lg:text-5xl">
            Explore the Community.
          </h1>
          <p className="mt-2 max-w-lg text-[10px] font-black text-indigo-500/70 uppercase tracking-[0.3em] leading-relaxed">
            A high-quality gallery for creators to share their vision.
          </p>
        </motion.div>
      </header>

      {/* Gallery Section Header */}
      <section className="mx-auto max-w-7xl px-4 mt-8 mb-8 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between border-b border-slate-100 pb-6 dark:border-white/5">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black tracking-tight">LATEST SHOTS</h2>
            <p className="text-slate-400 font-bold tracking-wide uppercase text-[9px]">Recently shared by the community</p>
          </div>
          <div className="flex gap-1.5">
            <div className="h-1.5 w-10 rounded-full bg-indigo-600" />
            <div className="h-1.5 w-3 rounded-full bg-slate-200 dark:bg-zinc-800" />
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <main className="mx-auto max-w-7xl px-4 pb-32 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: PHOTOS_LIMIT }).map((_, i) => (
              <PhotoSkeleton key={i} />
            ))}
          </div>
        ) : photos?.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {photos?.map((photo, idx) => (
                <motion.div
                  key={photo._id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (idx % PHOTOS_LIMIT) * 0.1, ease: "easeOut" }}
                  className="group flex flex-col"
                >
                  {/* Image Container */}
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[40px] bg-slate-100 dark:bg-zinc-900 shadow-2xl transition-transform duration-500 group-hover:-translate-y-2 text-white">
                    {isPreviewable(photo?.contentType) ? (
                      <img
                        src={photo.url}
                        alt={photo.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 p-8 dark:bg-zinc-800">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl dark:bg-zinc-900 text-indigo-500">
                          <AlertCircle size={40} />
                        </div>
                        <h4 className="text-center text-sm font-black uppercase tracking-tight text-slate-400 dark:text-zinc-500">
                          Preview Not Supported
                        </h4>
                        <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400/60">
                          {photo.contentType.split('/')[1] || 'Unknown'} Format
                        </p>
                      </div>
                    )}

                    {/* Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col items-center justify-center gap-4">
                      <div className="flex gap-4 transform scale-50 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white hover:text-black transition-all cursor-pointer">
                          <Eye size={24} />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(photo);
                          }}
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          <Download size={24} />
                        </button>
                      </div>

                      {isAuthenticated && user && user.email === photo.uploadedBy && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(photo._id);
                          }}
                          className="flex items-center gap-2 rounded-full bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-100 backdrop-blur-md border border-rose-500/30 transform translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white"
                        >
                          <Trash2 size={16} />
                          DELETE SHOT
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Info Section */}
                  <div className="mt-8 px-6">
                    <h3 className="text-2xl font-black uppercase tracking-tight text-[#1A1A1A] dark:text-white truncate">
                      {photo.title}
                    </h3>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6 dark:border-white/5">
                      {/* User Info - Revamped Contributor Card with Hover Email */}
                      <div className="group/artist relative flex items-center gap-4 cursor-help" title={photo.uploadedBy}>
                        <div className="relative">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 shadow-inner dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-400 transition-transform duration-300 group-hover/artist:scale-95">
                            <span className="text-xs font-black uppercase">{photo.uploadedBy[0]}</span>
                          </div>
                          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white dark:border-zinc-900">
                            <CheckCircle size={10} strokeWidth={3} />
                          </div>
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-black text-indigo-500 tracking-[0.2em] uppercase">Artist</span>
                          </div>
                          <div className="relative h-5">
                            <span className="absolute inset-0 text-sm font-black text-[#1A1A1A] dark:text-white uppercase truncate max-w-[120px] tracking-tight transition-all duration-300 group-hover/artist:-translate-y-full group-hover/artist:opacity-0">
                              {photo.uploadedBy.split('@')[0]}
                            </span>
                            <span className="absolute inset-0 text-[10px] font-bold text-slate-400 dark:text-zinc-500 lowercase truncate max-w-[150px] translate-y-full opacity-0 transition-all duration-300 group-hover/artist:translate-y-0 group-hover/artist:opacity-100">
                              {photo.uploadedBy}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock size={12} />
                          <span className="text-[10px] font-bold tracking-widest uppercase">Posted</span>
                        </div>
                        <span className="text-xs font-bold text-[#1A1A1A] dark:text-zinc-400 mt-1 uppercase">
                          {formatDistanceToNow(new Date(photo.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Infinite Scroll Trigger */}
            <div ref={ref} className="mt-20">
              {isFetchingMore && (
                <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: Math.min(PHOTOS_LIMIT, 3) }).map((_, i) => (
                    <PhotoSkeleton key={i} />
                  ))}
                </div>
              )}
              {!hasMore && photos.length > 0 && (
                <div className="flex flex-col items-center gap-2 text-slate-300 dark:text-zinc-700">
                  <div className="h-px w-24 bg-current" />
                  <span className="text-[10px] font-black tracking-[0.3em] uppercase">End of Gallery</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[40px] border-2 border-dashed border-slate-100 py-32 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-900/50">
            <ImageIcon size={64} className="text-slate-200 dark:text-zinc-800" />
            <h3 className="mt-6 text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Gallery is Empty</h3>
            <p className="mt-2 text-slate-500 dark:text-zinc-500 font-medium">Be the first to share your vision with the world.</p>
            <button
              onClick={() => (isAuthenticated ? setIsUploadModalOpen(true) : setIsAuthModalOpen(true))}
              className="mt-8 rounded-full bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
            >
              Start Uploading
            </button>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900"
            >
              <div className="p-8">
                <button
                  onClick={() => setIsAuthModalOpen(false)}
                  className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                >
                  <X size={20} />
                </button>

                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                    <Send size={32} />
                  </div>
                  <h2 className="mt-6 text-2xl font-bold">Secure Access</h2>
                  <p className="mt-2 text-slate-600 dark:text-zinc-400">
                    {step === 1
                      ? "Enter your email to receive a verification code."
                      : `Enter the code sent to ${email}`}
                  </p>
                </div>

                <div className="mt-8 space-y-4 text-left">
                  {error && (
                    <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-500/10">
                      <AlertCircle size={18} />
                      {error}
                    </div>
                  )}

                  {step === 1 ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-800/50 dark:focus:border-indigo-500"
                      />
                      <button
                        onClick={handleSendOtp}
                        disabled={authLoading}
                        className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:opacity-70"
                      >
                        {authLoading ? <Loader2 className="animate-spin" size={20} /> : "Send OTP"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Verification Code</label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-bold tracking-[1em] outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-800/50"
                      />
                      <button
                        onClick={handleVerifyOtp}
                        disabled={authLoading}
                        className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:opacity-70"
                      >
                        {authLoading ? <Loader2 className="animate-spin" size={20} /> : "Verify & Continue"}
                      </button>
                      <button
                        onClick={() => setStep(1)}
                        className="mt-4 w-full text-center text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-zinc-500"
                      >
                        Change Email
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Revamped Multiple Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[40px] bg-white shadow-2xl dark:bg-zinc-900"
            >
              <div className="flex flex-col h-full max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 p-8 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                      <Files size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-[#1A1A1A] dark:text-white uppercase">Share Your Vision</h2>
                      <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">Multiple Choice & Batch Upload</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {error && (
                    <div className="mb-8 flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:bg-rose-500/10">
                      <AlertCircle size={20} />
                      {error}
                    </div>
                  )}

                  {/* Drag & Drop Zone */}
                  {uploadItems.length === 0 ? (
                    <motion.div
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      className={cn(
                        "group relative flex h-[350px] flex-col items-center justify-center rounded-[40px] border-4 border-dashed transition-all duration-300",
                        isDragging
                          ? "border-indigo-600 bg-indigo-50/50 scale-[0.98] dark:bg-indigo-900/10"
                          : "border-slate-100 bg-slate-50 hover:border-indigo-600/50 dark:border-white/5 dark:bg-zinc-800/50"
                      )}
                    >
                      <input
                        type="file"
                        accept={ACCEPTED_IMAGE_EXTENSIONS.join(',')}
                        multiple
                        hidden
                        id="batchFileInput"
                        onChange={handleFileChange}
                      />
                      <label htmlFor="batchFileInput" className="cursor-pointer text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-indigo-600 shadow-2xl transition-transform group-hover:scale-110 dark:bg-zinc-900">
                          <Upload size={32} />
                        </div>
                        <h3 className="text-xl font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight">Drop your shots here</h3>
                        <p className="mt-2 text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                          OR CLICK TO EXPLORE FILES
                        </p>
                        <div className="mt-8 flex gap-4 justify-center flex-wrap">
                          {ACCEPTED_IMAGE_EXTENSIONS.map((ext) => (
                            <span key={ext} className="rounded-full bg-white px-4 py-1.5 text-[10px] font-black text-slate-400 shadow-sm dark:bg-zinc-900 dark:text-zinc-600 uppercase">
                              {ext.replace('.', '')}
                            </span>
                          ))}
                        </div>
                      </label>
                    </motion.div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <AnimatePresence>
                        {uploadItems.map((item) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-xl dark:border-white/5 dark:bg-zinc-800"
                          >
                            <div className="h-24 w-24 overflow-hidden rounded-2xl bg-slate-100 dark:bg-zinc-900 shadow-inner flex items-center justify-center">
                              {isPreviewable(item.file.type) ? (
                                <img src={item.preview} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center justify-center p-2 text-center">
                                  <AlertCircle size={24} className="text-slate-300 dark:text-zinc-700" />
                                  <span className="mt-1 text-[8px] font-bold text-slate-400 uppercase leading-tight">No Preview</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-1 flex-col pr-8">
                              <label className="text-[10px] font-black text-indigo-600 tracking-widest uppercase mb-1">Photo Title</label>
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => updateTitle(item.id, e.target.value)}
                                className="w-full bg-transparent text-sm font-black text-[#1A1A1A] outline-none dark:text-white uppercase tracking-tight"
                                placeholder="Shot Title..."
                              />
                            </div>
                            <button
                              onClick={() => removeFile(item.id)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all dark:hover:bg-rose-500/10"
                            >
                              <Trash2 size={18} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {/* Add More Trigger */}
                      <label className="flex h-[130px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 transition-all hover:bg-white hover:shadow-xl dark:border-white/5 dark:bg-zinc-800/30">
                        <input
                          type="file"
                          accept={ACCEPTED_IMAGE_EXTENSIONS.join(',')}
                          multiple
                          hidden
                          onChange={handleFileChange}
                        />
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-indigo-600 shadow-md dark:bg-zinc-900">
                          <Plus size={20} />
                        </div>
                        <span className="mt-2 text-[10px] font-black text-slate-400 tracking-widest uppercase">Add More Shots</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                {uploadItems.length > 0 && (
                  <div className="border-t border-slate-100 p-8 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xl font-black text-[#1A1A1A] dark:text-white tracking-tight">{uploadItems.length} SHOTS</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">READY TO PUBLISH</span>
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setUploadItems([])}
                        className="rounded-full px-8 py-3 text-sm font-bold text-slate-500 hover:text-rose-600 transition-all"
                      >
                        CANCEL ALL
                      </button>
                      <button
                        onClick={handleUpload}
                        disabled={uploadLoading}
                        className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-indigo-600 px-10 py-4 text-sm font-bold text-white shadow-2xl shadow-indigo-600/30 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-70"
                      >
                        {uploadLoading ? <Loader2 className="animate-spin" size={20} /> : (
                          <>
                            <CheckCircle size={20} />
                            <span>PUBLISH ALL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-8 shadow-2xl dark:bg-zinc-900"
            >
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                  <Trash2 size={32} />
                </div>
                <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">Delete Photo?</h2>
                <p className="mt-2 text-slate-600 dark:text-zinc-400">
                  This action cannot be undone. This photo will be permanently removed from the community gallery.
                </p>
                <div className="mt-8 flex flex-col gap-3">
                  <button
                    onClick={handleDeletePhoto}
                    disabled={deleteLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 font-semibold text-white shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-600 disabled:opacity-70"
                  >
                    {deleteLoading ? <Loader2 className="animate-spin" size={20} /> : "Yes, Delete Permanent"}
                  </button>
                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setPhotoToDelete(null);
                    }}
                    className="w-full rounded-xl bg-slate-100 py-3 font-semibold text-slate-700 transition-all hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-8 shadow-2xl dark:bg-zinc-900"
            >
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                  <AlertCircle size={32} />
                </div>
                <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight leading-none">Sign Out?</h2>
                <p className="mt-4 text-slate-600 dark:text-zinc-400">
                  Are you sure you want to log out? <br /> You'll need to verify your email again to upload photos.
                </p>
                <div className="mt-8 flex flex-col gap-3">
                  <button
                    onClick={handleLogout}
                    className="w-full rounded-xl bg-rose-500 py-4 font-black uppercase text-white shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-600 active:scale-95"
                  >
                    Yes, Lougout
                  </button>
                  <button
                    onClick={() => setIsLogoutModalOpen(false)}
                    className="w-full rounded-xl bg-slate-100 py-4 font-black uppercase text-slate-700 transition-all hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-20 dark:border-white/5">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mx-auto mb-6 dark:bg-indigo-500/10">
            <ImageIcon size={24} />
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">© 2024 OpenGallery</p>
          <p className="mt-2 text-[10px] font-bold text-slate-300 dark:text-zinc-700 uppercase tracking-widest">Share your vision with the world safely.</p>
        </div>
      </footer>
    </div>
  );
}
