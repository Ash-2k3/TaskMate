interface TimePickerProps {
  value: string | null;
  onChange: (time: string | null) => void;
  disabled?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const selectClass =
  'h-9 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-foreground cursor-pointer ' +
  'focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ' +
  'appearance-none';

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const [hour, minute] = value ? value.split(':') : ['09', '00'];

  function handleHour(h: string) {
    onChange(`${h}:${minute}`);
  }

  function handleMinute(m: string) {
    onChange(`${hour}:${m}`);
  }

  function handleClear() {
    onChange(null);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={hour}
        onChange={(e) => handleHour(e.target.value)}
        disabled={disabled}
        className={selectClass}
        aria-label="Hour"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-muted-foreground text-sm font-medium">:</span>
      <select
        value={minute}
        onChange={(e) => handleMinute(e.target.value)}
        disabled={disabled}
        className={selectClass}
        aria-label="Minute"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
}
