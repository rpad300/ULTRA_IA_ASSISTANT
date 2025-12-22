import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Network,
    Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface RelationshipNode {
    id: string;
    name: string;
    type: 'contact' | 'company' | 'project';
    strength: number; // 0-100
}

interface RelationshipEdge {
    from: string;
    to: string;
    type: 'colleague' | 'client' | 'partner' | 'project';
    strength: number; // 0-100
}

interface RelationshipGraphProps {
    contactId: string;
    relatedContacts?: Array<{ id: string; name: string; type: string }>;
    companies?: Array<{ id: string; name: string }>;
    projects?: Array<{ id: string; name: string }>;
}

export function RelationshipGraph({
    contactId,
    relatedContacts = [],
    companies = [],
    projects = []
}: RelationshipGraphProps) {
    const { nodes, edges } = useMemo(() => {
        const nodes: RelationshipNode[] = [
            {
                id: `contact-${contactId}`,
                name: "Current Contact",
                type: 'contact',
                strength: 100
            }
        ];

        const edges: RelationshipEdge[] = [];

        // Add related contacts
        relatedContacts.forEach(contact => {
            const nodeId = `contact-${contact.id}`;
            // Check if node already exists
            if (!nodes.find(n => n.id === nodeId)) {
                nodes.push({
                    id: nodeId,
                    name: contact.name,
                    type: 'contact',
                    strength: 60 + Math.random() * 30
                });
                edges.push({
                    from: `contact-${contactId}`,
                    to: nodeId,
                    type: 'colleague',
                    strength: 50 + Math.random() * 40
                });
            }
        });

        // Add companies
        companies.forEach(company => {
            const nodeId = `company-${company.id}`;
            // Check if node already exists
            if (!nodes.find(n => n.id === nodeId)) {
                nodes.push({
                    id: nodeId,
                    name: company.name,
                    type: 'company',
                    strength: 80
                });
                edges.push({
                    from: `contact-${contactId}`,
                    to: nodeId,
                    type: 'client',
                    strength: 70
                });
            }
        });

        // Add projects
        projects.forEach(project => {
            const nodeId = `project-${project.id}`;
            // Check if node already exists
            if (!nodes.find(n => n.id === nodeId)) {
                nodes.push({
                    id: nodeId,
                    name: project.name,
                    type: 'project',
                    strength: 70
                });
                edges.push({
                    from: `contact-${contactId}`,
                    to: nodeId,
                    type: 'project',
                    strength: 60
                });
            }
        });

        return { nodes, edges };
    }, [contactId, relatedContacts, companies, projects]);

    const getNodeColor = (type: string) => {
        switch (type) {
            case 'contact':
                return 'bg-primary/20 text-primary border-primary/30';
            case 'company':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'project':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getEdgeColor = (type: string) => {
        switch (type) {
            case 'colleague':
                return 'border-green-500/30';
            case 'client':
                return 'border-blue-500/30';
            case 'partner':
                return 'border-purple-500/30';
            case 'project':
                return 'border-orange-500/30';
            default:
                return 'border-gray-500/30';
        }
    };

    return (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Network className="h-4 w-4 text-primary" />
                        Relationship Network
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                            <Maximize2 className="h-3 w-3 mr-1" />
                            Expand
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                {nodes.length === 1 ? (
                    <div className="text-center py-8">
                        <p className="text-xs text-muted-foreground">
                            Nenhuma conexão encontrada ainda
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Simplified Network Visualization */}
                        <div className="relative min-h-[300px] border border-border rounded-lg bg-muted/20 p-4">
                            {/* Central Node */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className={cn(
                                        "px-3 py-2 rounded-lg border text-xs font-medium",
                                        getNodeColor('contact')
                                    )}
                                >
                                    You
                                </motion.div>
                            </div>

                            {/* Connected Nodes */}
                            {nodes.slice(1).map((node, index) => {
                                const angle = (index * 360) / (nodes.length - 1);
                                const radius = 120;
                                const x = Math.cos((angle * Math.PI) / 180) * radius;
                                const y = Math.sin((angle * Math.PI) / 180) * radius;

                                return (
                                    <motion.div
                                        key={node.id}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="absolute"
                                        style={{
                                            left: `calc(50% + ${x}px)`,
                                            top: `calc(50% + ${y}px)`,
                                            transform: 'translate(-50%, -50%)'
                                        }}
                                    >
                                        <div className={cn(
                                            "px-2 py-1 rounded border text-xs",
                                            getNodeColor(node.type)
                                        )}>
                                            {node.name.length > 15
                                                ? node.name.substring(0, 15) + '...'
                                                : node.name}
                                        </div>
                                        {/* Connection Line */}
                                        <div
                                            className={cn(
                                                "absolute top-1/2 left-1/2 w-24 border-t-2 -z-10",
                                                getEdgeColor(edges.find(e => e.to === node.id)?.type || 'colleague')
                                            )}
                                            style={{
                                                transform: `rotate(${angle}deg)`,
                                                transformOrigin: '0 50%'
                                            }}
                                        />
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />
                                <span>Contact</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
                                <span>Company</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/30" />
                                <span>Project</span>
                            </div>
                        </div>

                        {/* Node List */}
                        <div className="space-y-2 pt-2 border-t border-border">
                            <p className="text-xs font-semibold">Connected Entities</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {nodes.slice(1).map((node) => (
                                    <div
                                        key={node.id}
                                        className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                node.type === 'contact' ? 'bg-primary' :
                                                    node.type === 'company' ? 'bg-blue-500' :
                                                        'bg-purple-500'
                                            )} />
                                            <span>{node.name}</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {Math.round(node.strength)}%
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

