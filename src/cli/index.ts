#!/usr/bin/env node
import { connect } from './connect';

connect().catch((err) => {
  console.error(`\nUnexpected error: ${err?.message ?? err}`);
  process.exit(1);
});
