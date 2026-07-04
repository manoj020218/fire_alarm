import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/status/StatusBadge';

describe('StatusBadge', () => {
  it('renders status text when no label provided', () => {
    render(<StatusBadge status="ON" />);
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('renders custom label when provided', () => {
    render(<StatusBadge status="ON" label="Running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.queryByText('ON')).not.toBeInTheDocument();
  });

  it('renders ALARM status', () => {
    render(<StatusBadge status="ALARM" />);
    expect(screen.getByText('ALARM')).toBeInTheDocument();
  });

  it('renders FAULT status', () => {
    render(<StatusBadge status="FAULT" />);
    expect(screen.getByText('FAULT')).toBeInTheDocument();
  });

  it('renders offline status', () => {
    render(<StatusBadge status="offline" label="Offline" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders connected status', () => {
    render(<StatusBadge status="connected" label="Connected" />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });
});
