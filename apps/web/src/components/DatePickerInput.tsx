import DatePicker from "react-datepicker";

type Props = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  min?: string;
  max?: string;
  dark?: boolean;
};

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(date: Date | null) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DatePickerInput({ value, onChange, ariaLabel, min, max, dark = false }: Props) {
  return <DatePicker
    selected={parseDate(value)}
    onChange={(date) => onChange(formatDate(date))}
    minDate={parseDate(min)}
    maxDate={parseDate(max)}
    dateFormat="yyyy-MM-dd"
    placeholderText="YYYY-MM-DD"
    ariaLabelledBy={undefined}
    aria-label={ariaLabel}
    showMonthDropdown
    showYearDropdown
    dropdownMode="select"
    wrapperClassName="date-picker-wrapper"
    className={dark ? "date-picker-input-dark" : "date-picker-input"}
    popperPlacement="bottom-end"
  />;
}
