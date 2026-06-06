import TipsPageContent from "./TipsPageContent";

// Visible to all staff roles. What each role can do (release, edit, view-only) is
// enforced inside TipsPageContent and the tip APIs.
const TipsPage = () => {
  return <TipsPageContent />;
};

export default TipsPage;
