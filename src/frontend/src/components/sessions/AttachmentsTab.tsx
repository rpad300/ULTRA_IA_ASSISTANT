import React, { useEffect, useState, useMemo } from 'react';
import { workspaceApi } from '../../api/client';
import {
    File as FileIcon, ExternalLink, RefreshCw, Upload, Image,
    Music, Video, FileText, Grid3X3, List as ListIcon,
    Search, Copy, Sparkles, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMeetingStore } from '@/store/meetingStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AttachmentsTabProps {
    projectId: string;
}

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    iconLink: string;
    createdTime: string;
    thumbnailLink?: string;
    size?: string;
    owners?: { displayName: string, photoLink?: string }[];
    isOptimistic?: boolean; // For UI optimimism
}

// Mock type for context proof scoring
interface FileContextStatus {
    isMentioned: boolean;
    lastMentionedBlockId?: string;
    relevanceScore: number;
}

export const AttachmentsTab: React.FC<AttachmentsTabProps> = ({ projectId }) => {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [filterType, setFilterType] = useState<'all' | 'image' | 'document' | 'media'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [contextFiles, setContextFiles] = useState<Record<string, FileContextStatus>>({});
    const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);

    // Store Access for Context Proof
    const transcriptBlocks = useMeetingStore(state => state.transcriptBlocks);

    const loadFiles = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await workspaceApi.getProjectFiles(projectId);
            setFiles(data);
        } catch (error) {
            console.error("Failed to load files", error);
            if (!silent) toast.error("Failed to load project files");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            loadFiles();
        }
    }, [projectId]);

    // Debounced Context Proof Engine
    useEffect(() => {
        if (!files.length || !transcriptBlocks.length) return;

        const timeoutId = setTimeout(() => {
            const newContextMap: Record<string, FileContextStatus> = {};
            // Analyze last 20 blocks
            const recentBlocks = transcriptBlocks.slice(-20);

            files.forEach(file => {
                if (file.isOptimistic) return;

                const nameStem = file.name.split('.')[0].toLowerCase();
                // Performance: Skip short names (common words)
                if (nameStem.length <= 4) return;

                const matchingBlock = recentBlocks.find(b => b.text.toLowerCase().includes(nameStem));

                if (matchingBlock) {
                    newContextMap[file.id] = {
                        isMentioned: true,
                        lastMentionedBlockId: matchingBlock.id,
                        relevanceScore: 1
                    };
                }
            });

            setContextFiles(newContextMap);
        }, 2000); // 2s Debounce

        return () => clearTimeout(timeoutId);
    }, [files, transcriptBlocks.length]);

    // Dropzone Configuration
    const onDrop = async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        // Optimistic UI: Add files immediately
        const optimisticFiles: DriveFile[] = acceptedFiles.map((file, idx) => ({
            id: `temp-${Date.now()}-${idx}`,
            name: file.name,
            mimeType: file.type,
            webViewLink: '#',
            iconLink: '',
            createdTime: new Date().toISOString(),
            isOptimistic: true
        }));

        setFiles(prev => [...optimisticFiles, ...prev]);

        // Process actual uploads
        try {
            // Parallel upload for multiple files? Assuming sequential for safer implementation for now
            for (const file of acceptedFiles) {
                await workspaceApi.uploadProjectFile(projectId, file);
            }
            toast.success(`Uploaded ${acceptedFiles.length} file(s)`);

            // Refresh list to get real IDs / links
            loadFiles(true);

        } catch (error) {
            console.error("Upload failed", error);
            toast.error("Upload failed");
            // Revert changes on error (simple reload)
            loadFiles(true);
        }
    };

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        noClick: true, // Specific trigger
        noKeyboard: true
    });

    const getFileIcon = (mimeType: string, className = "w-5 h-5") => {
        if (mimeType.includes('image')) return <Image className={`${className} text-purple-400`} />;
        if (mimeType.includes('audio')) return <Music className={`${className} text-pink-400`} />;
        if (mimeType.includes('video')) return <Video className={`${className} text-red-400`} />;
        if (mimeType.includes('pdf')) return <FileText className={`${className} text-orange-400`} />;
        if (mimeType.includes('sheet') || mimeType.includes('csv')) return <FileText className={`${className} text-green-400`} />;
        return <FileIcon className={`${className} text-blue-400`} />;
    };

    // Derived filtered files
    const filteredFiles = useMemo(() => {
        return files.filter(f => {
            // Type Filter
            if (filterType === 'image' && !f.mimeType.includes('image')) return false;
            if (filterType === 'document' && !f.mimeType.includes('pdf') && !f.mimeType.includes('doc') && !f.mimeType.includes('sheet')) return false;
            if (filterType === 'media' && !f.mimeType.includes('audio') && !f.mimeType.includes('video')) return false;

            // Search Filter
            if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            return true;
        }).sort((a, b) => {
            // Optimistic files first
            if (a.isOptimistic && !b.isOptimistic) return -1;
            if (!a.isOptimistic && b.isOptimistic) return 1;

            // Sort by Context Relevance first, then Date
            const aContext = contextFiles[a.id]?.isMentioned ? 1 : 0;
            const bContext = contextFiles[b.id]?.isMentioned ? 1 : 0;
            if (aContext !== bContext) return bContext - aContext;

            return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
        });
    }, [files, filterType, searchQuery, contextFiles]);

    const copyLink = (link: string) => {
        navigator.clipboard.writeText(link);
        toast.success("Link copied");
    };

    const formatFileSize = (size?: string) => {
        if (!size) return 'Unknown';
        const bytes = parseInt(size);
        if (isNaN(bytes)) return size; // Return as is if already formatted
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div
            {...getRootProps()}
            className="h-full flex flex-col bg-black/40 backdrop-blur-xl relative overflow-hidden group/container outline-none"
            tabIndex={0} // Ensure dropzone is focusable? actually we handle keydown via dropzone ref usually
        >
            <input {...getInputProps()} className="hidden" />

            {/* Glass Drop Overlay */}
            <AnimatePresence>
                {isDragActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-8 pointer-events-none border-2 border-blue-500/50 border-dashed m-4 rounded-3xl"
                    >
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1.1 }}
                            transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5 }}
                        >
                            <div className="p-6 rounded-full bg-blue-500/20 border border-blue-500/30 mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                <Upload className="w-12 h-12 text-blue-400" />
                            </div>
                        </motion.div>
                        <h3 className="text-2xl font-bold text-white mb-2">Solte para anexar ao Projeto</h3>
                        <p className="text-white/60">Seus arquivos serão processados instantaneamente</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header Area */}
            <div className="flex flex-col gap-4 p-4 border-b border-white/10 bg-white/5">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                        Project Assets
                        <span className="text-xs font-normal text-white/40 bg-white/10 px-1.5 py-0.5 rounded-full">
                            {files.length}
                        </span>
                    </h3>

                    <div className="flex items-center gap-1">
                        <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5 mr-2">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-white/20 text-white shadow-sm" : "text-gray-400 hover:text-white")}
                            >
                                <Grid3X3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-white/20 text-white shadow-sm" : "text-gray-400 hover:text-white")}
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            onClick={() => loadFiles(false)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                            title="Refresh"
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        </button>

                        <button
                            onClick={open}
                            className={cn(
                                "ml-2 flex items-center gap-2 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-all shadow-lg",
                                "bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/20 active:scale-95"
                            )}
                        >
                            <Upload className="w-3.5 h-3.5" />
                            Upload
                        </button>
                    </div>
                </div>

                {/* Filters & Search - Same as before */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {(['all', 'image', 'document', 'media'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                                    filterType === type
                                        ? "bg-white text-black border-white"
                                        : "bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-gray-200"
                                )}
                            >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Filter files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 exotic-scrollbar">
                {files.length === 0 && !loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                        <div className="p-4 rounded-full bg-white/5 border border-white/5">
                            <Upload className="w-6 h-6 opacity-50" />
                        </div>
                        <p className="text-sm">No files yet. Drag & drop to upload.</p>
                    </div>
                ) : (
                    <div
                        className={cn(
                            "grid gap-3 transition-all",
                            viewMode === 'grid' ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "grid-cols-1"
                        )}
                    >
                        <AnimatePresence mode="popLayout">
                            {loading && files.length === 0
                                ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} mode={viewMode} />)
                                : filteredFiles.map((file) => (
                                    <FileItem
                                        key={file.id}
                                        file={file}
                                        mode={viewMode}
                                        context={contextFiles[file.id]}
                                        onCopy={() => copyLink(file.webViewLink)}
                                        getFileIcon={getFileIcon}
                                        onViewDetails={() => setSelectedFile(file)}
                                    />
                                ))
                            }
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
                <DialogContent className="bg-[#1A1A1A] border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 truncate">
                            {selectedFile && getFileIcon(selectedFile.mimeType, "w-5 h-5")}
                            <span className="truncate">{selectedFile?.name}</span>
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            File Properties
                        </DialogDescription>
                    </DialogHeader>

                    {selectedFile && (
                        <div className="space-y-4 py-2">
                            {/* Preview if Image */}
                            {selectedFile.mimeType.includes('image') && selectedFile.thumbnailLink && (
                                <div className="w-full h-48 rounded-lg overflow-hidden bg-black/20 border border-white/5 flex items-center justify-center">
                                    <img src={selectedFile.thumbnailLink} alt="Preview" className="h-full object-contain" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Created</p>
                                    <p>{format(new Date(selectedFile.createdTime), 'PPP p')}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Type</p>
                                    <p className="truncate" title={selectedFile.mimeType}>{selectedFile.mimeType.split('/').pop()?.toUpperCase()}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Size</p>
                                    <p>{formatFileSize(selectedFile.size)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Owner</p>
                                    {selectedFile.owners && selectedFile.owners.length > 0 ? (
                                        <div className="flex items-center gap-2">
                                            {selectedFile.owners[0].photoLink && (
                                                <img src={selectedFile.owners[0].photoLink} alt="" className="w-5 h-5 rounded-full" />
                                            )}
                                            <span className="truncate">{selectedFile.owners[0].displayName}</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-500 italic">Unknown</span>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex gap-2 items-start">
                                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p>This file is stored in your secure project workspace. Sharing the link allows others with access to view it.</p>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setSelectedFile(null)} className="hover:bg-white/10 text-gray-300">
                            Close
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                            disabled={selectedFile?.isOptimistic}
                            onClick={() => selectedFile && !selectedFile.isOptimistic && window.open(selectedFile.webViewLink, '_blank')}
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            {selectedFile?.isOptimistic ? "Uploading..." : "Open in Drive"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// Subcomponent: File Item
const FileItem = ({
    file,
    mode,
    context,
    onCopy,
    getFileIcon,
    onViewDetails
}: {
    file: DriveFile,
    mode: 'grid' | 'list',
    context?: FileContextStatus,
    onCopy: () => void,
    getFileIcon: (mime: string, className?: string) => React.JSX.Element,
    onViewDetails: () => void
}) => {
    const isImage = file.mimeType.includes('image');

    // Generated Card Fallback for Grid
    const GeneratedCard = () => {
        // Colors map for different types
        const type = file.mimeType.split('/').pop()?.toUpperCase() || 'FILE';
        let bgClass = "bg-gray-800";
        let textClass = "text-gray-400";

        if (file.mimeType.includes('pdf')) { bgClass = "bg-orange-500/10"; textClass = "text-orange-500"; }
        else if (file.mimeType.includes('sheet') || file.mimeType.includes('csv')) { bgClass = "bg-green-500/10"; textClass = "text-green-500"; }
        else if (file.mimeType.includes('doc')) { bgClass = "bg-blue-500/10"; textClass = "text-blue-500"; }
        else if (file.mimeType.includes('zip')) { bgClass = "bg-yellow-500/10"; textClass = "text-yellow-500"; }

        return (
            <div className={`w-full h-full flex flex-col items-center justify-center ${bgClass} transition-colors group-hover:bg-opacity-20`}>
                <span className={`text-2xl font-black ${textClass} tracking-tighter`}>{type.slice(0, 4)}</span>
                {/* Tiny decoration */}
                <div className="mt-2 w-8 h-1 rounded-full bg-current opacity-20" />
            </div>
        );
    };

    const handleOpenLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (file.isOptimistic) {
            toast('Uploading file...', { icon: '⏳' });
            return;
        }
        window.open(file.webViewLink, '_blank');
    };

    // Grid View
    if (mode === 'grid') {
        return (
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={cn(
                    "group relative aspect-square rounded-2xl overflow-hidden border transition-all cursor-pointer bg-[#0A0A0A]",
                    context?.isMentioned ? "border-amber-500/50 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]" : "border-white/5 hover:border-white/20 hover:shadow-xl"
                )}
                onClick={onViewDetails}
            >
                {/* Context Badge */}
                {context?.isMentioned && (
                    <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded-full shadow-lg backdrop-blur-md animate-pulse">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>CONTEXT</span>
                    </div>
                )}

                {/* Loading / Optimistic Skeleton */}
                {file.isOptimistic && (
                    <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mb-2" />
                        <span className="text-[10px] font-medium text-white/80">UPLOADING</span>
                    </div>
                )}

                {/* Preview / Thumbnail */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {isImage && file.thumbnailLink ? (
                        <img
                            src={file.thumbnailLink}
                            alt={file.name}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110"
                        />
                    ) : (
                        <GeneratedCard />
                    )}
                </div>

                {/* Hover Overlay with Actions */}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent translate-y-[10px] opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 flex flex-col justify-end z-10">
                    <p className="text-xs text-white font-medium truncate mb-2 drop-shadow-md">{file.name}</p>

                    <div className="flex items-center justify-between gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onCopy(); }}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                            title="Copy Link"
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={handleOpenLink}
                            disabled={file.isOptimistic}
                            className={cn(
                                "p-1.5 rounded-lg text-white transition-colors backdrop-blur-sm",
                                file.isOptimistic ? "bg-white/5 text-white/30 cursor-wait" : "bg-blue-600/80 hover:bg-blue-600"
                            )}
                            title={file.isOptimistic ? "Uploading..." : "Open in Drive"}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    // List View
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
                "group flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer",
                context?.isMentioned ? "bg-amber-500/5 border-amber-500/30" : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
            )}
            onClick={onViewDetails}
        >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center border border-white/5 overflow-hidden relative">
                {/* Mini Generated Card or Image */}
                {isImage && file.thumbnailLink ? (
                    <img src={file.thumbnailLink} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                        {getFileIcon(file.mimeType)}
                    </div>
                )}
                {file.isOptimistic && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200 truncate group-hover:text-blue-400 transition-colors">{file.name}</span>
                    {context?.isMentioned && (
                        <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            Context
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>{format(new Date(file.createdTime), 'MMM d, yyyy')}</span>
                    {file.isOptimistic && <span className="text-blue-400 font-medium">Uploading...</span>}
                </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onCopy(); }}
                    className="p-2 hover:bg-white/10 rounded-md text-gray-400 hover:text-white"
                >
                    <Copy className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                    onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
                    className="p-2 hover:bg-white/10 rounded-md text-gray-400 hover:text-white"
                >
                    <Info className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
};

const SkeletonCard = ({ mode }: { mode: 'grid' | 'list' }) => {
    if (mode === 'grid') {
        return (
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="aspect-square rounded-2xl bg-white/5 animate-pulse border border-white/5"
            />
        );
    }
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="h-16 w-full rounded-xl bg-white/5 animate-pulse border border-white/5"
        />
    );
};
