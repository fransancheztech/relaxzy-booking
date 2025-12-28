import { phoneValidator } from "@/utils/phoneValidator";

const page = () => {
    const phoneNumber = phoneValidator("663359457");
    return (
        <>
            <div>Probando</div>
            <pre>{JSON.stringify(phoneNumber, null, 2)}</pre>
        </>
    )
}

export default page