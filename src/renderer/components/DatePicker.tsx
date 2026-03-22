import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';

interface DatePickerProps {
  value: string | null;
  onChange: (date: string | null) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = value ? new Date(value + 'T00:00:00') : undefined;

  const displayLabel = value
    ? format(parseISO(value + 'T00:00:00'), 'EEE, MMM d')
    : 'No due date';

  function handleSelect(date: Date | undefined) {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setOpen(false);
    }
  }

  function handleClear() {
    onChange(null);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={value ? 'text-foreground' : 'text-muted-foreground'}
        >
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
        />
        <div className="p-2 border-t">
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Clear
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
