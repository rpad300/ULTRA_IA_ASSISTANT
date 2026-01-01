import { useState, useEffect } from "react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator
} from "@/components/ui/command";
import {
    Building2,
    FolderKanban,
    MessageSquare,
    Users,
    CheckSquare,
    LayoutDashboard,
    Calculator,
    Settings,
    User
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspaceApi } from "@/api/client";

interface GlobalCommandPaletteProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function GlobalCommandPalette({ open, onOpenChange }: GlobalCommandPaletteProps) {
    const navigate = useNavigate();
    const { companies, projects, threads, fetchCompanies, fetchProjects, fetchThreads } = useWorkspaceStore();
    const [contacts, setContacts] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);

    // Fetch data when palette opens
    useEffect(() => {
        if (open) {
            fetchCompanies();
            // Fetch projects for all companies
            if (Array.isArray(companies)) {
                companies.forEach(company => {
                    fetchProjects(company.id);
                });
            }
            // Fetch threads for all projects
            if (Array.isArray(projects)) {
                projects.forEach(project => {
                    fetchThreads(project.id);
                });
            }
            // Fetch contacts and tasks
            workspaceApi.getContacts().then(setContacts).catch(() => { });
            workspaceApi.getTasks({ status: 'open' }).then(setTasks).catch(() => { });
        }
    }, [open, companies.length, projects.length]); // Dependencies tuned to avoid infinite loops but catch updates

    const runCommand = (command: () => void) => {
        if (onOpenChange) onOpenChange(false);
        command();
    };

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="Suggestions">
                    <CommandItem value="dashboard home" onSelect={() => runCommand(() => navigate("/"))}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </CommandItem>
                    <CommandItem value="my tasks" onSelect={() => runCommand(() => navigate("/tasks"))}>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        <span>My Tasks</span>
                    </CommandItem>
                    <CommandItem value="analytics" onSelect={() => runCommand(() => navigate("/analytics"))}>
                        <Calculator className="mr-2 h-4 w-4" />
                        <span>Analytics</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Companies">
                    {companies.map((company) => (
                        <CommandItem
                            key={company.id}
                            value={company.name}
                            onSelect={() => runCommand(() => navigate(`/companies/${company.id}/projects`))}
                        >
                            <Building2 className="mr-2 h-4 w-4" />
                            <span>{company.name}</span>
                        </CommandItem>
                    ))}
                    <CommandItem value="view all companies" onSelect={() => runCommand(() => navigate("/companies"))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>View All Companies...</span>
                    </CommandItem>
                </CommandGroup>

                <CommandGroup heading="Projects">
                    {projects.slice(0, 10).map((project) => (
                        <CommandItem
                            key={project.id}
                            value={project.name}
                            onSelect={() => runCommand(() => navigate(`/companies/${project.company_id}/projects/${project.id}`))}
                        >
                            <FolderKanban className="mr-2 h-4 w-4" />
                            <span>{project.name}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>

                <CommandGroup heading="Threads">
                    {(threads || []).slice(0, 10).map((thread) => (
                        <CommandItem
                            key={thread.id}
                            value={thread.title}
                            onSelect={() => runCommand(() => navigate(`/threads/${thread.id}`))}
                        >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            <span>{thread.title}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>

                <CommandGroup heading="Tasks">
                    {tasks.slice(0, 5).map((task) => (
                        <CommandItem
                            key={task.id}
                            value={task.description}
                            onSelect={() => runCommand(() => navigate(`/tasks`))} // Or specific task view if available
                        >
                            <CheckSquare className="mr-2 h-4 w-4" />
                            <span>{task.description}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>

                <CommandGroup heading="Contacts">
                    {contacts.slice(0, 10).map((contact) => (
                        <CommandItem
                            key={contact.id}
                            value={contact.name}
                            onSelect={() => runCommand(() => navigate(`/contacts/${contact.id}`))}
                        >
                            <Users className="mr-2 h-4 w-4" />
                            <span>{contact.name}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Settings">
                    <CommandItem value="profiles" onSelect={() => runCommand(() => navigate("/profiles"))}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profiles</span>
                    </CommandItem>
                    <CommandItem value="settings" onSelect={() => runCommand(() => navigate("/settings"))}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}


