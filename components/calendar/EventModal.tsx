'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { EVENT_CATEGORY_CONFIG } from '@/lib/constants';
import { useCalendar } from '@/context/CalendarContext';
import type { CalendarEvent, EventCategory } from '@/types/calendar';

interface EventModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
}

export function EventModal({ event, open, onClose, defaultDate }: EventModalProps) {
  const { dispatch } = useCalendar();
  const isNew = !event;

  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'joint');
  const owner = event?.owner ?? 'both';
  const [startDate, setStartDate] = useState(
    event?.startDate ? event.startDate.split('T')[0] : (defaultDate ?? new Date().toISOString().split('T')[0])
  );

  const handleSave = () => {
    if (!title.trim()) return;
    if (isNew) {
      dispatch({
        type: 'ADD_EVENT',
        payload: {
          title: title.trim(),
          description,
          category,
          owner,
          startDate: `${startDate}T09:00:00.000Z`,
          endDate: `${startDate}T10:00:00.000Z`,
          allDay: false,
        },
      });
    } else {
      dispatch({ type: 'UPDATE_EVENT', payload: { id: event.id, title: title.trim(), description, category, owner } });
    }
    onClose();
  };

  const handleDelete = () => {
    if (event) {
      dispatch({ type: 'DELETE_EVENT', payload: { id: event.id } });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Neuer Termin' : 'Termin bearbeiten'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titel</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Terminname..." autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={v => setCategory(v as EventCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(EVENT_CATEGORY_CONFIG) as [EventCategory, typeof EVENT_CATEGORY_CONFIG[EventCategory]][])
                    .filter(([k]) => k !== 'task-deadline')
                    .map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Datum</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          {!isNew && (
            <Button variant="destructive" size="sm" onClick={handleDelete} className="mr-auto">
              <Trash2 className="h-3.5 w-3.5 mr-1" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button size="sm" onClick={handleSave} disabled={!title.trim()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
