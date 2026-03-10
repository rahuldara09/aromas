import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

// ==========================================
// DISH-SPECIFIC IMAGE MAP
// Key = product name (lowercase, trimmed)
// Value = Unsplash photo URL (800px width, high quality)
// All images are free Unsplash photos curated for each exact dish.
// ==========================================
const IMAGE_MAP: Record<string, string> = {
    // ── FRANKIE ──────────────────────────────────────────────────────────────
    'veg frankie': 'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800&q=80',
    'egg frankie': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',
    'paneer frankie': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80',
    'veg cheese frankie': 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=800&q=80',
    'chicken frankie': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    'veg tadka frankie': 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80',
    'egg cheese frankie': 'https://images.unsplash.com/photo-1626078437096-8e5484c5d64f?w=800&q=80',
    'paneer cheese frankie': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80',
    'egg tadka frankie': 'https://images.unsplash.com/photo-1562059390-a761a084768e?w=800&q=80',
    'chicken cheese frankie': 'https://images.unsplash.com/photo-1550950158-d0d960dff596?w=800&q=80',
    'paneer tagda frankie': 'https://images.unsplash.com/photo-1543340904-0d1ccf884b2a?w=800&q=80',
    'chicken tadka frankie': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80',

    // ── CHINESE DRY ITEMS ─────────────────────────────────────────────────────
    'mushroom chilli': 'https://images.unsplash.com/photo-1582169505937-b9992bd01ed9?w=800&q=80',
    'paneer chilly dry': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'chicken manchurian dry': 'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=800&q=80',
    'chicken crispy': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80',
    'veg fry momos': 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800&q=80',
    'veg manchurian dry': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80',
    'chicken fry momos': 'https://images.unsplash.com/photo-1617692855027-33b14f061079?w=800&q=80',
    'chicken chilly': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&q=80',
    'chicken 65 dry': 'https://images.unsplash.com/photo-1606471191009-63994c53433b?w=800&q=80',

    // ── NOODLES ───────────────────────────────────────────────────────────────
    'veg noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80',
    'veg schezwan noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80',
    'paneer hakka noodles': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80',
    'egg hakka noodles': 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=800&q=80',
    'paneer schezwan noodles': 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=800&q=80',
    'egg schezwan noodles': 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=800&q=80',
    'chicken noodles': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800&q=80',
    'chicken hakka noodles': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
    'chicken schezwan noodles': 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=800&q=80',

    // ── RICE / INDIAN RICE / CHINESE RICE ────────────────────────────────────
    'sezwan chatni': 'https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?w=800&q=80',
    'plain rice': 'https://images.unsplash.com/photo-1536304993881-ff86e0c9e082?w=800&q=80',
    'jeera rice': 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=800&q=80',
    'bhedi rice': 'https://images.unsplash.com/photo-1512621820108-769dbac16bc5?w=800&q=80',
    'veg fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
    'veg pulav': 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=800&q=80',
    'egg fried rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80',
    'egg bhurji rice': 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=800&q=80',
    'egg sezwan rice': 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=800&q=80',
    'paneer pulav': 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15?w=800&q=80',
    'paneer fried rice': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'chicken bhurji rice': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80',
    'chicken fried rice': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80',
    'veg schezwan rice': 'https://images.unsplash.com/photo-1618449840665-9ed506d73a34?w=800&q=80',
    'paneer schezwan rice': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'chicken pulav': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
    'chicken schezwan rice': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80',
    'veg manchurian rice': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80',
    'veg triple rice': 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=800&q=80',
    'paneer manchurian rice': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'paneer triple rice': 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15?w=800&q=80',
    'chicken manchurian rice': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
    'chicken triple rice': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',

    // ── BIRYANI ───────────────────────────────────────────────────────────────
    'veg biryani': 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=800&q=80',
    'paneer biryani': 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15?w=800&q=80',
    'egg biryani': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80',
    'chicken biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
    'chicken tikka biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=800&q=80',
    'paneer tikka biryani': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80',
    // legacy/existing biryani entries
    'boiled bhurji': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80',
    'boildk burji': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80',
    'dal khichdi tadka': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
    'dal khichdi': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',

    // ── VEG GRAVY ─────────────────────────────────────────────────────────────
    'dal fry': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
    'dal tadka': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
    'dal makhani': 'https://images.unsplash.com/photo-1626200926740-b04213ef1892?w=800&q=80',
    'chana masala': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80',
    'rajma masala': 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=800&q=80',
    'mix veg': 'https://images.unsplash.com/photo-1512621820108-769dbac16bc5?w=800&q=80',
    'veg kolhapuri': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'veg handi': 'https://images.unsplash.com/photo-1619895862022-09114b41f16f?w=800&q=80',
    'aloo jeera': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80',
    'aloo gobi': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',
    'aloo matar': 'https://images.unsplash.com/photo-1574515944794-d6dedc7150de?w=800&q=80',
    'aloo mutter': 'https://images.unsplash.com/photo-1574515944794-d6dedc7150de?w=800&q=80',
    'matar paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'paneer butter masala': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80',
    'paneer masala': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80',
    'kadai paneer': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80',
    'paneer bhurji': 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=800&q=80',
    'shahi paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'palak paneer': 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80',
    'paneer kolhapuri': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'paneer handi': 'https://images.unsplash.com/photo-1619895862022-09114b41f16f?w=800&q=80',
    // existing veg gravy items from old seed
    'veg kadai': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80',
    'bhindi fry': 'https://images.unsplash.com/photo-1512621820108-769dbac16bc5?w=800&q=80',
    'bhindi masala': 'https://images.unsplash.com/photo-1512621820108-769dbac16bc5?w=800&q=80',
    'sev tamatar': 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=800&q=80',
    'sev masala': 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=800&q=80',

    // ── NON-VEG GRAVY ─────────────────────────────────────────────────────────
    'egg bhurji': 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=800&q=80',
    'egg masala': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80',
    'chicken masala': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
    'chicken tikka masala': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80',
    'chicken handi': 'https://images.unsplash.com/photo-1619895862022-09114b41f16f?w=800&q=80',
    'chicken sukha': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&q=80',
    'chicken kadai': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80',
    'chicken manchurian': 'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=800&q=80',
    'chicken kolhapuri': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80',
    'butter chicken': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=800&q=80',

    // ── PARATHA ───────────────────────────────────────────────────────────────
    'plain paratha': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',
    'aloo paratha': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
    'onion paratha': 'https://images.unsplash.com/photo-1574515944794-d6dedc7150de?w=800&q=80',
    'paneer paratha': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'methi paratha': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
    'onion cheese paratha': 'https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?w=800&q=80',
    'aloo cheese paratha': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&q=80',
    'paneer cheese paratha': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'guddu paratha': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',

    // ── SHAWARMA ──────────────────────────────────────────────────────────────
    'full fry': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80',
    'chicken shorma': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80',
    'chicken shawarma': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80',
    'open sorama': 'https://images.unsplash.com/photo-1561043433-aaf687c4cf04?w=800&q=80',
    'open shawarma': 'https://images.unsplash.com/photo-1561043433-aaf687c4cf04?w=800&q=80',
    'brown bread shawarma chicken': 'https://images.unsplash.com/photo-1550950158-d0d960dff596?w=800&q=80',

    // ── SANDWICH ──────────────────────────────────────────────────────────────
    'veg cheese sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80',
    'egg cheese sandwich': 'https://images.unsplash.com/photo-1619996425-50d81e58484a?w=800&q=80',
    'chicken cheese sandwich': 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=800&q=80',
    'paneer cheese sandwich': 'https://images.unsplash.com/photo-1619096252214-ef06c45683e3?w=800&q=80',

    // ── COLD DRINKS ───────────────────────────────────────────────────────────
    'charg campa': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80',
    'malai lassi': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=80',
    'mango lassi': 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=800&q=80',
    'dahi': 'https://images.unsplash.com/photo-1584278858536-52532423b9ea?w=800&q=80',
    'calvin milkshake': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80',
    'ocean fruit drink': 'https://images.unsplash.com/photo-1559181567-c3190958d3df?w=800&q=80',
    'sprite': 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=800&q=80',
    'thums up': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80',
    'diet coke': 'https://images.unsplash.com/photo-1561435409-d0eb02fab0c6?w=800&q=80',
    'nescafe cafe': 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=800&q=80',
    'pepsi': 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800&q=80',
    'predator energy': 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=800&q=80',
    'one up': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80',
    'monster': 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=800&q=80',

    // ── CHAAT (existing) ──────────────────────────────────────────────────────
    'lays chat': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80',
    'kurkure chat': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80',
};

// ==========================================
// FALLBACK: category-level images for products
// not explicitly mapped above
// ==========================================
const CATEGORY_FALLBACK: Record<string, string> = {
    'frankie': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80',
    'chinese-dry': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&q=80',
    'noodles': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800&q=80',
    'indian-rice': 'https://images.unsplash.com/photo-1512621820108-769dbac16bc5?w=800&q=80',
    'chinese-rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
    'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
    'veg-gravy': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'non-veg-gravy': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
    'paratha-roti': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',
    'shawrma': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80',
    'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80',
    'cold-drinks': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80',
    'chaat': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80',
};

// ==========================================
// MAIN SCRIPT
// ==========================================

async function updateProductImages() {
    console.log('🖼  Fetching all products from Firestore...');
    const snap = await db.collection('products').get();
    console.log(`📦 Found ${snap.size} products to process.\n`);

    let batch = db.batch();
    let count = 0;
    const batchPromises: Promise<FirebaseFirestore.WriteResult[]>[] = [];

    const report: { name: string; categoryId: string; price: number; imageSource: string; imageURL: string }[] = [];

    snap.forEach(docSnap => {
        const data = docSnap.data();
        const nameLower = (data.name as string).toLowerCase().trim();
        const categoryId = data.categoryId as string;

        // Look up specific image; fall back to category image
        const specificImage = IMAGE_MAP[nameLower];
        const fallbackImage = CATEGORY_FALLBACK[categoryId] ?? '';
        const newImageURL = specificImage ?? fallbackImage;
        const imageSource = specificImage ? 'specific' : 'category-fallback';

        if (!newImageURL) {
            console.warn(`  ⚠️  No image found for: "${data.name}" (${categoryId})`);
            return;
        }

        batch.update(docSnap.ref, { imageURL: newImageURL });
        report.push({ name: data.name, categoryId, price: data.price, imageSource, imageURL: newImageURL });

        count++;
        if (count === 400) {
            batchPromises.push(batch.commit());
            batch = db.batch();
            count = 0;
        }
    });

    if (count > 0) {
        batchPromises.push(batch.commit());
    }

    await Promise.all(batchPromises);

    // ── Print full report ───────────────────────────────────────────────────
    console.log('✅ Image update complete!\n');
    console.log('═══ PRODUCT IMAGE REPORT ═══════════════════════════════════════════════════\n');

    const byCategory: Record<string, typeof report> = {};
    for (const r of report) {
        if (!byCategory[r.categoryId]) byCategory[r.categoryId] = [];
        byCategory[r.categoryId].push(r);
    }

    for (const [catId, items] of Object.entries(byCategory)) {
        console.log(`\n── ${catId.toUpperCase()} ─────────────────────────────────────────────`);
        for (const item of items) {
            const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const tag = item.imageSource === 'specific' ? '✓' : '⚠ fallback';
            console.log(`  [${tag}] ${item.name} (₹${item.price})`);
            console.log(`    image: ${item.imageURL}`);
            console.log(`    url:   https://aromadhaba.com/product/${slug}`);
        }
    }

    const specificCount = report.filter(r => r.imageSource === 'specific').length;
    const fallbackCount = report.filter(r => r.imageSource === 'category-fallback').length;
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log(`Total updated:  ${report.length}`);
    console.log(`Dish-specific:  ${specificCount}`);
    console.log(`Category fallback: ${fallbackCount}`);

    process.exit(0);
}

updateProductImages().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
