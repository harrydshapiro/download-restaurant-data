const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const csv = require('csv-parser');

const IMAGE_URLS_FILE = path.join(__dirname, 'image-urls.csv')
const OUTPUT_DIR = path.join(__dirname, 'output')

// Function to download an image
function downloadImage(url, outputFolder, fileName) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download image: ${url} - Status Code: ${response.statusCode}`));
                return;
            }

            const contentType = response.headers['content-type'];
            let extension = '';
            if (contentType) {
                const match = contentType.match(/image\/(jpeg|png|gif|bmp|webp)/);
                if (match) {
                    extension = `.${match[1]}`;
                }
            }

            const filePath = path.join(outputFolder, fileName + extension);
            const fileStream = fs.createWriteStream(filePath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close(() => resolve(filePath));
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    // Read the array of image URLs and restaurant names from the CSV file
    let imageData = [];
    try {
        const fileContent = fs.createReadStream(IMAGE_URLS_FILE);
        await new Promise((resolve, reject) => {
            fileContent
                .pipe(csv())
                .on('data', (row) => {
                    if (row.url && row.restaurant_name) {
                        imageData.push({ url: row.url, restaurantName: row.restaurant_name });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });
        if (imageData.length === 0) {
            throw new Error('The CSV file must contain at least one URL and restaurant name.');
        }
    } catch (err) {
        console.error(`Error reading or parsing the image URLs file: ${err.message}`);
        process.exit(1);
    }

    // Ensure the output folder exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Download each image
    for (const { url, restaurantName } of imageData) {
        try {
            const fileName = restaurantName;
            const filePath = await downloadImage(url, OUTPUT_DIR, fileName);
            console.log(`Downloaded: ${filePath}`);
        } catch (err) {
            console.error(`Failed to download ${url}: ${err.message}`);
        }
    }
}

main();