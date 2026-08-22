import Modal from './Modal';
const ROWS: [string, string][] = [['⌘ K  or  /', 'Command palette'], ['c', 'Check in / check out'], ['n', 'New time-off request'], ['t', 'Toggle dark mode'], ['g then e', 'Employees'], ['g then a', 'Attendance'], ['g then l', 'Time off'], ['g then d', 'Dashboard'], ['g then t', 'My team'], ['g then r', 'Reports'], ['?', 'This help']];
export default function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" width={420}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13, alignItems: 'center' }}>
        {ROWS.map(([k, d]) => <><kbd className="kbd" key={k}>{k}</kbd><span key={d}>{d}</span></>)}
      </div>
    </Modal>
  );
}
