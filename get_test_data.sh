cat > /tmp/dump_samples.js << 'EOF'
var seen = {};
db.listings.find().forEach(function(l) {
  var state = l.address && l.address.state;
  if (state && !seen[state]) {
    seen[state] = true;
    print("===STATE_LISTING===");
    printjson(l);
  }
});

print("===VIP_LISTING===");
printjson(db.listings.findOne({"vip_subscriptions": {$elemMatch: {"status": "active"}}}));

print("===PPC_LISTING===");
printjson(db.listings.findOne({"ppc_campaigns": {$exists: true, $ne: []}}));

print("===CAMPAIGNS===");
db.campaigns.find().limit(5).forEach(function(c) { printjson(c); });

print("===AD_RULES===");
db.ad_rules.find().forEach(function(r) { printjson(r); });

print("===AD_CLIENTS===");
db.ad_clients.find().forEach(function(c) { printjson(c); });
EOF

docker cp /tmp/dump_samples.js mongo:/tmp/dump_samples.js
docker exec mongo mongo udss-clientreach /tmp/dump_samples.js > testdata/samples.json
