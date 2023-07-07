/*
MIT License

Copyright (c) 2019 Haja Networks Oy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import type { IPFS } from "ipfs-core";

const defaultFilter = () => true;

export const connectPeers = async (
  ipfs1: IPFS,
  ipfs2: IPFS,
  options = {
    filter: defaultFilter,
  }
) => {
  const id1 = await ipfs1.id();
  const id2 = await ipfs2.id();

  const addresses1 = id1.addresses.filter(options.filter);
  const addresses2 = id2.addresses.filter(options.filter);
  if (addresses1.length && addresses2.length) {
    await ipfs1.swarm.connect(addresses2[0]);
    await ipfs2.swarm.connect(addresses1[0]);
  }
};

export const tousConnecter = async (sfips: IPFS[]) => {
  const connectés: IPFS[] = [];
  for (const sfip of sfips) {
    for (const autre of connectés) {
      await connectPeers(sfip, autre);
    }
    connectés.push(sfip);
  }
};
