package pe.com.fabrizio.cajalima.spending;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import pe.com.fabrizio.cajalima.shared.exception.ApiException;

public final class SpendingRules {
    private SpendingRules(){}
    public enum Method { CASH,YAPE,PLIN,TRANSFER }
    public static final BigDecimal MAX=new BigDecimal("999999999999.99");
    public static String text(String value){return value==null||value.isBlank()?null:value.strip();}
    public static boolean validText(String... values){
        for(String value:values)if(value!=null)for(int i=0;i<value.length();i++){
            char c=value.charAt(i);if(c==0)return false;
            if(Character.isHighSurrogate(c)){if(i+1>=value.length()||!Character.isLowSurrogate(value.charAt(++i)))return false;}
            else if(Character.isLowSurrogate(c))return false;
        }return true;
    }
    public static void date(LocalDate value){if(value.isBefore(LocalDate.of(2000,1,1))||value.isAfter(LocalDate.of(2100,12,31)))throw error(HttpStatus.BAD_REQUEST,"La fecha debe estar entre 2000 y 2100.");}
    public static Pageable page(int page,int size,String q,LocalDate from,LocalDate to){
        if(page<0||page>100000||size<1||size>100||q.length()>160||!validText(q))throw error(HttpStatus.BAD_REQUEST,"Revisa los filtros solicitados.");
        if(from!=null)date(from);if(to!=null)date(to);if(from!=null&&to!=null&&from.isAfter(to))throw error(HttpStatus.BAD_REQUEST,"La fecha inicial debe ser anterior a la final.");
        return PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"id"));
    }
    public static String hash(Object... fields){
        StringBuilder canonical=new StringBuilder();
        for(Object field:fields){String value=field==null?"":field.toString();canonical.append(value.length()).append(':').append(value);}
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical.toString().getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException ex){throw new IllegalStateException(ex);}
    }
    public static void replay(Long originalActor,Long actor,String originalHash,String hash){if(!originalActor.equals(actor)||!originalHash.equals(hash))throw error(HttpStatus.CONFLICT,"Esta referencia corresponde a otra solicitud. Revisa los registros.");}
    public static String money(BigDecimal value){return value.setScale(2).toPlainString();}
    public static ApiException error(HttpStatus status,String message){return new ApiException(status,message);}
}
