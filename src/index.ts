import axios from "axios";
import Stripe from "stripe";

import { APIResponse, VATSenseRate } from "./types";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const vatSenseApiKey = process.env.VAT_SENSE_API_KEY;

if (!stripeSecretKey) {
  console.log("STRIPE_SECRET_KEY is undefined!");
  process.exit(1);
}

if (!vatSenseApiKey) {
  console.log("VAT_SENSE_API_KEY is undefined!");
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2020-03-02",
});

const vatSenseClient = axios.create({
  baseURL: "https://api.vatsense.com/1.0/",
  auth: { username: "user", password: vatSenseApiKey },
});

const run = async () => {
  const { data: rates } = await vatSenseClient.get<APIResponse<VATSenseRate>>(
    "rates"
  );
  const vatRates = rates.data.filter((r) => r.eu);

  console.log(`Fetched ${vatRates.length} EU VAT rates from VAT Sense`);

  const stripeTaxRates = await stripe.taxRates
    .list()
    .autoPagingToArray({ limit: 10000 });
  console.log(`Fetched ${stripeTaxRates.length} tax rates from Stripe`);

  for (let index = 0; index < vatRates.length; index++) {
    const rate = vatRates[index];
    const stripeRate = stripeTaxRates.find(
      (r) => r.jurisdiction.trim() === rate.country_code.trim() && r.active
    );

    const newRate: Stripe.TaxRateCreateParams = {
      display_name: "VAT",
      inclusive: true,
      percentage: rate.standard.rate,
      active: true,
      jurisdiction: rate.country_code,
      description: `${rate.country_name} Inclusive VAT`,
    };

    if (stripeRate) {
      if (stripeRate.percentage !== rate.standard.rate) {
        // Disable existing rate
        await stripe.taxRates.update(stripeRate.id, { active: false });
        await stripe.taxRates.create(newRate);
      } else {
        console.log(
          `Rate for country ${rate.country_code} was not update cause percentage (${rate.standard.rate}) is the same`
        );
      }
    } else {
      // Create new stripe rate
      await stripe.taxRates.create(newRate);
      console.log(`Created a new stripe rate for country ${rate.country_code}`);
    }
  }
};

run().catch((e) => {
  console.error(e);
  if (e?.response?.data) {
    console.error(e.response.data);
  }
  process.exit(1);
});
