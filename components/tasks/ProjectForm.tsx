'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks } from '@/context/TasksContext';
import type { ProjectCategory } from '@/types/tasks';
import type { Owner } from '@/types/common';

const PROJECT_COLORS = ['#a78bfa', '#f472b6', '#60a5fa', '#f59e0b', '#34d399', '#f87171'];

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectForm({ open, onClose }: ProjectFormProps) {
  const { dispatch } = useTasks();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('joint');
  const [owner, setOwner] = useState<Owner>('both');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    dispatch({
      type: 'ADD_PROJECT',
      payload: { title: title.trim(), description, category, owner, color, tags: [], archived: false, dueDate: dueDate || undefined },
    });
    setTitle(''); setDescription(''); setDueDate('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neues Projekt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Projektname</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Projektname..." autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={v => setCategory(v as ProjectCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="joint">Joint</SelectItem>
                  <SelectItem value="personal-malin">Personal · Malin</SelectItem>
                  <SelectItem value="personal-kevin">Personal · Kevin</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={owner} onValueChange={v => setOwner(v as Owner)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="malin">Malin</SelectItem>
                  <SelectItem value="kevin">Kevin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fälligkeitsdatum</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Farbe</Label>
              <div className="flex gap-1.5 pt-1">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-5 w-5 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: color === c ? 'white' : 'transparent' }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" size="sm" disabled={!title.trim()}>Projekt erstellen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
