package pe.com.fabrizio.cajalima.account.dto;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.validation.constraints.*;
import pe.com.fabrizio.cajalima.account.domain.AccountPaymentMethod;

public record PaymentRequest(@NotNull UUID requestId,
        @NotNull @DecimalMin("0.01") @DecimalMax("999999999999.99") @Digits(integer=12,fraction=2) BigDecimal amount,
        @NotNull AccountPaymentMethod paymentMethod, @Size(max=240) String note) {
    public PaymentRequest { note=note==null || note.isBlank()?null:note.strip(); }
    @AssertTrue(message="Revisa los caracteres de la nota.")
    public boolean isNoteValidUnicode(){
        if(note==null)return true;
        for(int i=0;i<note.length();i++){
            char c=note.charAt(i);
            if(c==0 || Character.isLowSurrogate(c))return false;
            if(Character.isHighSurrogate(c)){
                if(i+1>=note.length() || !Character.isLowSurrogate(note.charAt(++i)))return false;
            }
        }
        return true;
    }
    @Override public String toString(){return "PaymentRequest[redacted]";}
}
