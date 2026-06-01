import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {

  return (
    <h1 className="text-7xl font-bold underline">
      Hello world!
    </h1>
  )
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
