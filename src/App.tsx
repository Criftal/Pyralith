import { useEffect } from 'react';
import { DataProvider } from './lib/data';
import { MissionProvider } from './lib/mission';
import { WeightsProvider } from './lib/weights';
import { href, useRoute } from './lib/router';
import { CiteProvider } from './components/Cite';
import TopBar from './components/TopBar';
import Footer from './components/Footer';
import Hook from './screens/Hook';
import MissionSelect from './screens/MissionSelect';
import Investigations from './screens/Investigations';
import GapMap from './screens/GapMap';
import Rank from './screens/Rank';
import Export from './screens/Export';
import NextFire from './screens/NextFire';
import Ask from './screens/Ask';
import { EmptyNote } from './components/States';

export default function App() {
  return (
    <DataProvider>
      <MissionProvider>
        <WeightsProvider>
          <CiteProvider>
            <Shell />
          </CiteProvider>
        </WeightsProvider>
      </MissionProvider>
    </DataProvider>
  );
}

function Shell() {
  const route = useRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  let screen;
  switch (route) {
    case '/':
      screen = <Hook />;
      break;
    case '/mission':
      screen = <MissionSelect />;
      break;
    case '/investigations':
      screen = <Investigations />;
      break;
    case '/gap':
      screen = <GapMap />;
      break;
    case '/rank':
      screen = <Rank />;
      break;
    case '/export':
      screen = <Export />;
      break;
    case '/next':
      screen = <NextFire />;
      break;
    case '/ask':
      screen = <Ask />;
      break;
    default:
      screen = (
        <EmptyNote>
          No screen at this address. <a className="text-cool hover:underline" href={href('/')}>Go to the overview</a>.
        </EmptyNote>
      );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar route={route} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{screen}</main>
      <Footer />
    </div>
  );
}
