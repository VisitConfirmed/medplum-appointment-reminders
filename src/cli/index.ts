#!/usr/bin/env node
import { connect, printSupportFooter } from './connect';

connect().catch((err) => {
  console.error(`\nUnexpected error: ${err?.message ?? err}`);
  printSupportFooter();
  process.exit(1);
});
