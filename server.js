const express = require('express');
const webpush  = require('web-push');
const cors     = require('cors');

const app = express();
app.use(cors({
  origin: ['https://neborgood.github.io', 'http://localhost', 'http://127.0.0.1'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// VAPID keys — these are fixed, do not change
const VAPID_PUBLIC  = 'BPhisKtv3tSJVTNs3Etbphf9vtcdJEDHooqq_rsKDVoZ_j5pjELB46zeGHWb0bs7wiU-W53xLmcqwxWndOVzmfI';
const VAPID_PRIVATE = 'uBxldQfVgqShMM6yGwpjMA5nlyDuz9OwDStfVGyBh-o';

webpush.setVapidDetails('mailto:familychat@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

// Store subscriptions in memory (persists as long as server runs)
// Key = room:name, Value = subscription object
const subscriptions = {};

// Return the public VAPID key to the client
app.get('/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

// Client subscribes for push notifications
app.post('/subscribe', (req, res) => {
  const { subscription, name, room } = req.body;
  if (!subscription || !name || !room) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  subscriptions[room + ':' + name] = { subscription, name, room };
  console.log('Subscribed:', name, 'in room:', room, '| Total:', Object.keys(subscriptions).length);
  res.json({ ok: true });
});

// Client sends a message and we push to everyone else in the room
app.post('/notify', async (req, res) => {
  const { room, sender, text } = req.body;
  if (!room || !sender || !text) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const payload = JSON.stringify({
    title: sender + ' — Family Chat',
    body: text.slice(0, 100),
    room: room
  });

  // Find all subscribers in this room except the sender
  const targets = Object.values(subscriptions).filter(s => s.room === room && s.name !== sender);
  console.log('Notifying', targets.length, 'people in room:', room, 'from:', sender);

  const results = await Promise.allSettled(
    targets.map(t =>
      webpush.sendNotification(t.subscription, payload).catch(err => {
        // If subscription expired, remove it
        if (err.statusCode === 410) {
          delete subscriptions[t.room + ':' + t.name];
          console.log('Removed expired subscription for:', t.name);
        }
      })
    )
  );

  res.json({ ok: true, notified: targets.length });
});

// Health check so Render keeps the server awake
app.get('/', (req, res) => res.send('Family Chat push server running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Push server running on port', PORT));
