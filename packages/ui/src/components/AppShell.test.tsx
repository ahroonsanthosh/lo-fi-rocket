import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axePageViolations } from '../test/axe-page.js';
import { AppShell, StatusItem } from './AppShell.js';
import { Button } from './Button.js';

function Shell(): JSX.Element {
  return (
    <AppShell
      header={
        <>
          <h1>Lo-Fi Rocket</h1>
          <Button>File</Button>
        </>
      }
      statusBar={<StatusItem label="Apogee">167.33 m</StatusItem>}
      navigation={<Button>Fins</Button>}
      main={
        <>
          <h2>Fins</h2>
          <Button>Add fins</Button>
        </>
      }
      checks={<h2>Warnings</h2>}
    />
  );
}

describe('AppShell', () => {
  it('provides the page landmarks with names', () => {
    render(<Shell />);
    expect(screen.getByRole('banner')).toHaveTextContent('Lo-Fi Rocket');
    expect(screen.getByRole('region', { name: 'Status' })).toHaveTextContent('Apogee167.33 m');
    expect(screen.getByRole('navigation', { name: 'Design steps' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Fins');
    expect(screen.getByRole('complementary', { name: 'Checks and warnings' })).toBeInTheDocument();
  });

  it('the first Tab reaches the skip link, which moves focus to the main view', async () => {
    render(<Shell />);
    await userEvent.tab();
    const skip = screen.getByRole('link', { name: 'Skip to the main view' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#lfr-main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'lfr-main');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('Tab order follows the reading order: header, status, navigation, main, checks', async () => {
    render(<Shell />);
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'File' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Fins' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Add fins' })).toHaveFocus();
  });

  it('has no axe violations as a whole page, landmark rules included', async () => {
    render(<Shell />);
    expect(await axePageViolations(document.body)).toEqual([]);
  });
});
