export const metadata = {
  title: "clank.money",
  description: "where agents register human bitcoin addresses"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
