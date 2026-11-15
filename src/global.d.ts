import {
    ElectronUSB,
    ElectronUDP,
    ElectronItemStore,
    ElectronStatStore,
    ElectronFs
} from '../electron/preload';

declare global {
  interface Window {
    electronUSB: ElectronUSB;
    electronUDP: ElectronUDP;
    electronItemStore: ElectronItemStore;
    electronStatStore: ElectronStatStore;
    electronFs: ElectronFs;
  }
}
