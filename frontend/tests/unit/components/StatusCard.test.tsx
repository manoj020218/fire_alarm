import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusCard } from '@/components/cards/StatusCard';
import { MdCheckCircle } from 'react-icons/md';

describe('StatusCard', () => {
  it('renders label and value', () => {
    render(<StatusCard label="System Status" value="NORMAL" icon={<MdCheckCircle />} />);
    expect(screen.getByText('System Status')).toBeInTheDocument();
    expect(screen.getByText('NORMAL')).toBeInTheDocument();
  });

  it('renders sub text when provided', () => {
    render(<StatusCard label="Devices" value="12/12" sub="All online" icon={<MdCheckCircle />} />);
    expect(screen.getByText('All online')).toBeInTheDocument();
  });

  it('does not render sub text when not provided', () => {
    const { container } = render(<StatusCard label="Alarms" value={3} icon={<MdCheckCircle />} />);
    // No sub paragraph expected
    expect(container.querySelectorAll('p').length).toBe(2); // label + value only
  });

  it('renders numeric value as string', () => {
    render(<StatusCard label="Alarms" value={5} icon={<MdCheckCircle />} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
