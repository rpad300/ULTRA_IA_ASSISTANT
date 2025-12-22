import { useState, useRef, useCallback } from "react";
import { Upload, File, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DragDropZoneProps {
    onFilesDropped: (files: File[]) => void;
    accept?: string;
    maxSize?: number; // in MB
    className?: string;
}

export function DragDropZone({ onFilesDropped, accept, maxSize = 10, className }: DragDropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = useCallback((file: File): boolean => {
        if (maxSize && file.size > maxSize * 1024 * 1024) {
            alert(`File ${file.name} is too large. Maximum size is ${maxSize}MB.`);
            return false;
        }
        if (accept) {
            const acceptedTypes = accept.split(',').map(type => type.trim());
            const fileType = file.type || '';
            const fileName = file.name.toLowerCase();
            const isAccepted = acceptedTypes.some(type => {
                if (type.startsWith('.')) {
                    return fileName.endsWith(type.toLowerCase());
                }
                return fileType.includes(type.replace('*', ''));
            });
            if (!isAccepted) {
                alert(`File ${file.name} is not an accepted file type.`);
                return false;
            }
        }
        return true;
    }, [accept, maxSize]);

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        
        const validFiles: File[] = [];
        Array.from(files).forEach(file => {
            if (validateFile(file)) {
                validFiles.push(file);
            }
        });
        
        if (validFiles.length > 0) {
            setDroppedFiles(prev => [...prev, ...validFiles]);
            onFilesDropped(validFiles);
        }
    }, [validateFile, onFilesDropped]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        
        const files = e.dataTransfer.files;
        handleFiles(files);
    }, [handleFiles]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
    }, [handleFiles]);

    const removeFile = useCallback((index: number) => {
        setDroppedFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    return (
        <div className={cn("space-y-4", className)}>
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                    isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                )}
            >
                <Upload className={cn(
                    "h-12 w-12 mx-auto mb-4 transition-colors",
                    isDragging ? "text-primary" : "text-muted-foreground"
                )} />
                <p className="text-sm font-medium mb-2">
                    {isDragging ? "Drop files here" : "Drag and drop files here"}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                    or click to browse
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                >
                    Select Files
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={accept}
                    onChange={handleFileInput}
                    className="hidden"
                />
                {accept && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Accepted: {accept}
                    </p>
                )}
                {maxSize && (
                    <p className="text-xs text-muted-foreground">
                        Max size: {maxSize}MB
                    </p>
                )}
            </div>

            {droppedFiles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium">Dropped files:</p>
                    {droppedFiles.map((file, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted"
                        >
                            <File className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 text-sm truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeFile(index)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

