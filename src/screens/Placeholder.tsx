import { EmptyNote, ScreenHeader } from '../components/States';

export default function Placeholder({ kicker, title, what }: { kicker: string; title: string; what: string }) {
  return (
    <div>
      <ScreenHeader kicker={kicker} title={title}>
        {what}
      </ScreenHeader>
      <EmptyNote>Next build step: this screen is in progress.</EmptyNote>
    </div>
  );
}
