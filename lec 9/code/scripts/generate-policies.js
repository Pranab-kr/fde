const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const policies = [
  {
    fileName: 'return_refund_policy.pdf',
    title: 'Return and Refund Policy',
    sections: [
      {
        heading: '1. Standard Return Window',
        body: 'Customers have exactly 30 calendar days from the delivery date to return eligible items for a full refund or exchange. Items must be postmarked before the 30-day window expires. After 30 days, returns are strictly ineligible for refund or store credit.'
      },
      {
        heading: '2. Item Condition Requirements',
        body: 'Returned merchandise must be completely unused, unworn, unwashed, and in its original retail packaging with all manufacturer tags intact. Proof of purchase or original order confirmation receipt is required with every return package.'
      },
      {
        heading: '3. Return Shipping Costs',
        body: 'Standard returns for customer remorse or sizing issues incur a flat $5.99 return shipping fee deducted from the final refund. If the return is due to a warehouse mistake, defective product, or transit damage, return shipping is completely free.'
      },
      {
        heading: '4. Refund Processing Timeline',
        body: 'Once our warehouse receives and inspects the return (typically 2-3 business days), refunds are issued to the original payment method within 5 to 7 business days. Banks and credit card issuers may take an additional 3-5 business days to post the balance.'
      }
    ]
  },
  {
    fileName: 'shipping_delivery_policy.pdf',
    title: 'Shipping and Delivery Policy',
    sections: [
      {
        heading: '1. Shipping Methods and Delivery Speeds',
        body: 'We provide Standard Shipping (3 to 5 business days), Expedited Shipping (2 business days), and Next-Day Priority Delivery. Orders placed before 1:00 PM EST Monday through Friday are processed and dispatched on the same business day.'
      },
      {
        heading: '2. Free Shipping Eligibility',
        body: 'Standard shipping is free on all orders with a subtotal exceeding $50.00 within the contiguous United States before taxes and after discounts. Orders under $50.00 are charged a flat standard shipping rate of $6.50.'
      },
      {
        heading: '3. Carrier Tracking and Notifications',
        body: 'Every shipment is tracked via UPS, FedEx, or USPS. An automated shipping confirmation email containing the real-time tracking number is sent when the order leaves our logistics center.'
      },
      {
        heading: '4. International Shipping & Customs',
        body: 'We ship internationally to over 45 supported countries. International delivery takes 7 to 15 business days. Customers are responsible for all applicable import tariffs, VAT, and customs clearance charges.'
      }
    ]
  },
  {
    fileName: 'privacy_cookie_policy.pdf',
    title: 'Privacy and Cookie Policy',
    sections: [
      {
        heading: '1. Personal Information Collection',
        body: 'We collect customer contact details, shipping addresses, payment details processed via PCI-DSS Level 1 compliant gateways, and browsing telemetry solely to provide order fulfillment, customer support, and tailored recommendations.'
      },
      {
        heading: '2. Use of Cookies and Tracking',
        body: 'Our store utilizes functional cookies to maintain shopping cart sessions, analytical cookies to evaluate site traffic, and marketing cookies. Customers may disable non-essential cookies at any time through our Privacy Preference Center.'
      },
      {
        heading: '3. Data Retention and Deletion Rights',
        body: 'Under GDPR and CCPA, customers have the legal right to request access to, correction of, or permanent deletion of their personal records. Data deletion requests are processed within 30 days upon email verification to privacy@store.com.'
      },
      {
        heading: '4. Security and Data Protection',
        body: 'All transactional communications are encrypted using Transport Layer Security (TLS 1.3). We never sell, lease, or rent customer personal data to third-party marketing firms.'
      }
    ]
  },
  {
    fileName: 'terms_of_service.pdf',
    title: 'Terms of Service',
    sections: [
      {
        heading: '1. Account Registration and Security',
        body: 'Users must be at least 18 years old or possess legal guardian consent to register an account. Account owners are solely responsible for maintaining credentials secrecy and all activity executed under their profile.'
      },
      {
        heading: '2. Pricing, Availability, and Order Acceptance',
        body: 'All prices are shown in USD and are subject to real-time adjustments without notice. We reserve the right to decline or cancel any order flagged for potential fraud or containing clerical pricing discrepancies.'
      },
      {
        heading: '3. Intellectual Property Rights',
        body: 'All brand graphics, product descriptions, interface designs, audio, and proprietary code featured on this site are the exclusive property of the store and protected under international copyright and trademark legislation.'
      },
      {
        heading: '4. Dispute Resolution & Governing Law',
        body: 'These Terms are governed by and construed in accordance with the laws of the State of Delaware. Any disputes arising from transactions will be resolved through binding individual arbitration rather than court litigation.'
      }
    ]
  },
  {
    fileName: 'warranty_repairs_policy.pdf',
    title: 'Warranty and Repairs Policy',
    sections: [
      {
        heading: '1. One-Year Limited Manufacturer Warranty',
        body: 'All electronic hardware and durable goods sold directly by our store include a complimentary 1-year limited warranty against factory defects in materials and craftsmanship, effective starting from the delivery date.'
      },
      {
        heading: '2. Exclusions from Warranty Coverage',
        body: 'The warranty explicitly excludes accidental physical damage, water submersion, cosmetic wear-and-tear, battery degradation from normal usage, unauthorized repairs, or unauthorized third-party hardware modifications.'
      },
      {
        heading: '3. Warranty Claim Process',
        body: 'To file a claim, email support@store.com with your order number, clear photographs or videos of the defect, and a detailed description. If verified, we will issue a prepaid return label and ship a replacement or repaired unit within 7 business days.'
      }
    ]
  },
  {
    fileName: 'cancellation_policy.pdf',
    title: 'Order Cancellation Policy',
    sections: [
      {
        heading: '1. Instant Cancellation Window',
        body: 'Customers can self-cancel an order directly from their account dashboard within 2 hours of order placement. Full refunds for self-cancelled orders are triggered instantly back to the original payment method.'
      },
      {
        heading: '2. Orders Already Dispatched',
        body: 'Once an order has been marked as shipped or dispatched to the carrier warehouse (even if within 2 hours), it cannot be cancelled. The customer must wait for delivery and follow our standard 30-day Return and Refund Policy.'
      },
      {
        heading: '3. Custom and personalized Items',
        body: 'Custom-made, engraved, or personalized merchandise cannot be cancelled once production commences (typically 1 hour post-order), as these goods cannot be returned to general inventory.'
      }
    ]
  }
];

const targetDir = path.join(__dirname, '../policies');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function generatePDF(policy) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(targetDir, policy.fileName);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Title
    doc.fontSize(22).fillColor('#1A202C').text(policy.title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#718096').text('Official E-Commerce Store Policy Document', { align: 'center' });
    doc.moveDown(1.5);

    // Sections
    for (const section of policy.sections) {
      doc.fontSize(14).fillColor('#2B6CB0').text(section.heading);
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#2D3748').text(section.body, { lineGap: 4 });
      doc.moveDown(1);
    }

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

async function main() {
  console.log(`Generating ${policies.length} policy PDFs in ${targetDir}...`);
  for (const policy of policies) {
    const p = await generatePDF(policy);
    console.log(`- Created ${path.basename(p)}`);
  }
  console.log('Policy generation complete.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Failed to generate policies:', err);
    process.exit(1);
  });
}

module.exports = { policies, generatePDF };
