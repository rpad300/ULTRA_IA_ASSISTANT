import React, { useEffect, useState, useRef } from 'react';
import { workspaceApi } from '../../api/client';
import { File as FileIcon, ExternalLink, RefreshCw, Upload, Image, Music, Video, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

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
}

export const AttachmentsTab: React.FC<AttachmentsTabProps> = ({ projectId }) => {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const data = await workspaceApi.getProjectFiles(projectId);
            setFiles(data);
        } catch (error) {
            console.error("Failed to load files", error);
            // toast.error("Failed to load attachments");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            loadFiles();
        }
    }, [projectId]);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setUploading(true);
            try {
                await workspaceApi.uploadProjectFile(projectId, file);
                toast.success("File uploaded successfully");
                loadFiles();
            } catch (error) {
                console.error("Upload failed", error);
                toast.error("Failed to upload file");
            } finally {
                setUploading(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        }
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.includes('image')) return <Image className="w-5 h-5 text-purple-400" />;
        if (mimeType.includes('audio')) return <Music className="w-5 h-5 text-pink-400" />;
        if (mimeType.includes('video')) return <Video className="w-5 h-5 text-red-400" />;
        if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
        return <FileIcon className="w-5 h-5 text-blue-400" />;
    };

    return (
        <div className="h-full flex flex-col bg-[#1A1A1A]">
            <div className="flex justify-between items-center p-4 border-b border-white/10">
                <h3 className="text-sm font-medium text-gray-300">Project Attachments</h3>
                <div className="flex gap-2">
                    <button
                        onClick={loadFiles}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleUploadClick}
                        disabled={uploading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {files.length === 0 && !loading && (
                    <div className="text-center py-10 text-gray-500 text-sm">
                        No attachments found.
                    </div>
                )}

                {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="flex-shrink-0">
                                {getFileIcon(file.mimeType)}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-200 truncate pr-4" title={file.name}>
                                    {file.name}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <span>{format(new Date(file.createdTime), 'MMM d, yyyy')}</span>
                                    {/* <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                    <span>{file.mimeType.split('/').pop()}</span> */}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white"
                                title="Open in Drive"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
