import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlarmTable } from '@/components/tables/AlarmTable';
import { MOCK_ALARMS } from '@/data/mockAlarms';

describe('AlarmTable', () => {
  it('renders alarm rows', () => {
    render(<AlarmTable alarms={MOCK_ALARMS} onAck={vi.fn()} canAck={true} />);
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('shows empty state when no alarms', () => {
    render(<AlarmTable alarms={[]} onAck={vi.fn()} canAck={true} />);
    expect(screen.getByText(/no alarms/i)).toBeInTheDocument();
  });

  it('shows acknowledge button when canAck=true and alarm is not acked', () => {
    const unacked = MOCK_ALARMS.filter((a) => !a.acknowledged);
    render(<AlarmTable alarms={unacked} onAck={vi.fn()} canAck={true} />);
    expect(screen.getAllByRole('button', { name: /acknowledge/i }).length).toBeGreaterThan(0);
  });

  it('hides acknowledge button when canAck=false', () => {
    render(<AlarmTable alarms={MOCK_ALARMS} onAck={vi.fn()} canAck={false} />);
    // "Acknowledge" row buttons should not exist (filter tabs are different)
    expect(screen.queryByRole('button', { name: /^Acknowledge$/i })).not.toBeInTheDocument();
  });

  it('calls onAck with the alarm when ACK button is clicked', () => {
    const onAck = vi.fn();
    const unacked = MOCK_ALARMS.filter((a) => !a.acknowledged);
    render(<AlarmTable alarms={unacked} onAck={onAck} canAck={true} />);
    // Row-level ACK buttons have exact text "Acknowledge"
    const buttons = screen.getAllByRole('button', { name: /^Acknowledge$/i });
    fireEvent.click(buttons[0]);
    expect(onAck).toHaveBeenCalledWith(unacked[0]);
  });

  it('limits rows when limit prop is provided', () => {
    render(<AlarmTable alarms={MOCK_ALARMS} onAck={vi.fn()} canAck={true} limit={2} />);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(3); // header + 2 data rows
  });

  it('filters to active only when Active tab clicked', () => {
    render(<AlarmTable alarms={MOCK_ALARMS} onAck={vi.fn()} canAck={true} />);
    // Click the filter tab button specifically
    const activeButtons = screen.getAllByRole('button', { name: /^Active$/i });
    fireEvent.click(activeButtons[0]);
    const activeCount = MOCK_ALARMS.filter((a) => !a.acknowledged).length;
    const rows = screen.getAllByRole('row');
    expect(rows.length - 1).toBe(activeCount); // -1 for header
  });
});
